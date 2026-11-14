/**
 * OpenPath Integration Level 1: Drop-in Embed Loader
 *
 * Embeds any OpenPath form onto any website via a single script tag:
 *
 *   <div id="signup"></div>
 *   <script src="https://example.com/embed.js"
 *           data-form="onboard"
 *           data-lang="am"
 *           data-target="#signup"></script>
 *
 * Features:
 *   - Automatic iframe creation with accessible title (WCAG 4.1.2)
 *   - Microphone permissions delegation (Permissions Policy)
 *   - Zero inner scrollbars: bidirectional postMessage resize protocol
 *   - Dispatches DOM events on host ('openpath:ready', 'openpath:submitted', 'openpath:step')
 *   - Programmatic API via window.OpenPath.init()
 */
(function () {
  'use strict';

  var PROTOCOL_VERSION = 1;

  function resolveBaseUrl(script) {
    if (script && script.dataset && script.dataset.origin) {
      return script.dataset.origin.replace(/\/+$/, '');
    }
    if (script && script.src) {
      try {
        var u = new URL(script.src);
        return u.origin;
      } catch (e) {
        /* fallback below */
      }
    }
    return window.location.origin;
  }

  function createEmbed(cfg) {
    var form = cfg.form || 'onboard';
    var lang = cfg.lang || 'am';
    var baseUrl = cfg.baseUrl || window.location.origin;
    var target = cfg.target;

    var container = null;
    if (typeof target === 'string') {
      container = document.querySelector(target);
    } else if (target && target.nodeType === 1) {
      container = target;
    }

    var iframe = document.createElement('iframe');
    var iframeSrc = baseUrl + '/' + encodeURIComponent(form) + '?embed=1';
    if (lang) {
      iframeSrc += '&lang=' + encodeURIComponent(lang);
    }

    var title = cfg.title || (lang === 'am' ? 'የOpenPath ቅጽ' : 'OpenPath Accessible Form');
    iframe.src = iframeSrc;
    iframe.title = title;
    // Permissions policy: grant microphone for voice input while keeping all other sensors blocked
    iframe.allow = 'microphone';
    iframe.setAttribute('loading', 'lazy');

    // Inline styling to prevent layout shifts and eliminate inner scrollbars
    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.minHeight = '640px';
    iframe.style.display = 'block';
    iframe.style.overflow = 'hidden';
    iframe.style.transition = 'height 0.15s ease-out';

    function onMessage(event) {
      var data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.source !== 'openpath' || data.v !== PROTOCOL_VERSION) return;
      if (iframe.contentWindow && event.source !== iframe.contentWindow) return;

      if (data.type === 'resize' && typeof data.height === 'number') {
        var targetHeight = Math.max(480, Math.ceil(data.height));
        iframe.style.height = targetHeight + 'px';
      }

      var customEvent = new CustomEvent('openpath:' + data.type, {
        bubbles: true,
        cancelable: false,
        detail: data,
      });
      iframe.dispatchEvent(customEvent);
      window.dispatchEvent(customEvent);

      if (typeof cfg.onEvent === 'function') {
        cfg.onEvent(data);
      }
    }

    window.addEventListener('message', onMessage);

    if (container) {
      container.innerHTML = '';
      container.appendChild(iframe);
    } else if (cfg.scriptNode && cfg.scriptNode.parentNode) {
      cfg.scriptNode.parentNode.insertBefore(iframe, cfg.scriptNode);
    } else {
      document.body.appendChild(iframe);
    }

    return {
      iframe: iframe,
      destroy: function () {
        window.removeEventListener('message', onMessage);
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      },
      postToWidget: function (msg) {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            Object.assign({ source: 'openpath-host', v: PROTOCOL_VERSION }, msg),
            '*'
          );
        }
      },
    };
  }

  // Programmatic API
  window.OpenPath = window.OpenPath || {};
  window.OpenPath.init = createEmbed;

  // Auto-run if embedded via <script> tag with data attributes
  function autoInit() {
    var scripts = document.querySelectorAll('script[src*="embed.js"]');
    for (var i = 0; i < scripts.length; i++) {
      var script = scripts[i];
      if (script.getAttribute('data-loaded')) continue;
      script.setAttribute('data-loaded', 'true');

      var form = script.getAttribute('data-form') || 'onboard';
      var lang = script.getAttribute('data-lang') || 'am';
      var target = script.getAttribute('data-target');
      var title = script.getAttribute('data-title');
      var baseUrl = resolveBaseUrl(script);

      createEmbed({
        form: form,
        lang: lang,
        target: target,
        title: title,
        baseUrl: baseUrl,
        scriptNode: script,
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
})();
