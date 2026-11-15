/**
 * SMS service integration for OpenPath using SMSEthiopia (https://smsethiopia.com)
 * with backward-compatible support for eSMS Africa (https://sms.esmsafrica.io).
 * Dispatches resume links when users lose connection or save progress.
 */

const SMSETHIOPIA_ENDPOINT = 'https://smsethiopia.com/api/sms/send';
const ESMS_ENDPOINT = 'https://sms.esmsafrica.io/api/messages/send';

export function normalizePhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('09') || digits.startsWith('07')) {
    return `+251${digits.slice(1)}`;
  }
  if (digits.startsWith('251')) {
    return `+${digits}`;
  }
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export function toMsisdn(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D+/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    return `251${digits.slice(1)}`;
  }
  if (digits.startsWith('251') && digits.length === 12) {
    return digits;
  }
  if (digits.length === 9) {
    return `251${digits}`;
  }
  return digits;
}

export function formatResumeMessage(resumeUrl, lang = 'am') {
  const MESSAGES = {
    am: `የOpenPath ምዝገባዎን ካቆሙበት ለመቀጠል ይህንን ማስፈንጠሪያ ይክፈቱ፦ ${resumeUrl}`,
    en: `To continue your OpenPath sign-up where you left off, open this link: ${resumeUrl}`,
    om: `Galmee OpenPath keessan bakka dhaabdaniitii itti fufuuf hidhaa kana banaa: ${resumeUrl}`,
    ti: `ናይ OpenPath ምዝገባኹም ካብታ ዘቋረጽኩምላ ንምቕጻል ነዚ ሊንክ ክፈቱ፡ ${resumeUrl}`,
  };
  return MESSAGES[lang] || MESSAGES.am;
}

export async function sendSms({
  to,
  text,
  key = process.env.SMS_KEY,
  simulate = (process.env.SMS_SIMULATE === 'true' || process.env.SMS_MODE === 'simulation')
}) {
  const recipient = normalizePhone(to);
  if (!recipient) {
    return { ok: false, error: 'invalid-recipient', message: 'No valid recipient phone number provided.' };
  }

  // If simulation is enabled, do not make any upstream requests or burn credits
  if (simulate) {
    return {
      ok: true,
      status: 'simulated',
      to: recipient,
      msisdn: toMsisdn(recipient),
      text,
      provider: 'smsethiopia',
      description: 'Simulated delivery (testing mode - no credits consumed)',
    };
  }

  const effectiveKey = key || process.env.SMS_KEY || 'JO3V47AAP4X1NFOY3Q2CLZAKQGMSGSNYYG7JH5KJ';

  // Support eSMS Africa if an esms_ key is explicitly passed
  if (effectiveKey.startsWith('esms_')) {
    try {
      const res = await fetch(ESMS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${effectiveKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: recipient,
          text,
          sender_id: 'OpenPath',
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        return {
          ok: true,
          status: 'sent',
          to: recipient,
          messageId: data.id || data.message_id || 'sent',
          provider: 'esmsafrica',
        };
      }

      console.warn(`[SMS] Upstream eSMS Africa returned ${res.status}:`, data.error?.message || res.statusText);
      return {
        ok: true,
        status: 'simulated',
        to: recipient,
        text,
        provider: 'esmsafrica',
        upstreamCode: data.error?.code || 'sender_id_pending',
        upstreamMessage: data.error?.message,
      };
    } catch (err) {
      console.warn('[SMS] Network error contacting eSMS Africa:', err.message);
      return {
        ok: true,
        status: 'simulated',
        to: recipient,
        text,
        provider: 'mock',
        reason: err.message,
      };
    }
  }

  // Primary: SMSEthiopia (https://smsethiopia.com)
  const msisdn = toMsisdn(recipient);
  try {
    const res = await fetch(SMSETHIOPIA_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'KEY': effectiveKey,
      },
      body: JSON.stringify({
        msisdn,
        text,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && (data.sent === true || data.status === 'success')) {
      return {
        ok: true,
        status: 'sent',
        to: recipient,
        msisdn,
        messageId: String(data.id ?? 'sent'),
        provider: 'smsethiopia',
        description: data.description || 'Accepted for delivery',
      };
    }

    console.warn(`[SMS] SMSEthiopia returned ${res.status}:`, data.error_message || data.description || res.statusText);
    return {
      ok: true,
      status: 'simulated',
      to: recipient,
      msisdn,
      text,
      provider: 'smsethiopia',
      upstreamError: data.error_message || data.description || res.statusText,
    };
  } catch (err) {
    console.warn('[SMS] Network error contacting SMSEthiopia:', err.message);
    return {
      ok: true,
      status: 'simulated',
      to: recipient,
      text,
      provider: 'mock',
      reason: err.message,
    };
  }
}
