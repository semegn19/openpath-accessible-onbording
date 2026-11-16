import React, { useState, useMemo } from 'react';
import type { Lang, Schema } from './types';
import { c } from './copy';
import { t } from './i18n';
import { ReadAloudButton } from './speech';
import jobsData from './schemas/jobs.json';
import employerSchema from './schemas/employer-accommodations-v1.json';

export interface LocalizedJob {
  id: string;
  title: Record<Lang, string>;
  company: string;
  category: string;
  accommodations: string[];
  location: Record<Lang, string>;
  description: Record<Lang, string>;
}

export interface AccommodationOption {
  value: string;
  label: Record<Lang, string>;
  icon?: string;
}

const employerSteps = employerSchema.steps as unknown as Array<{
  id: string;
  options?: AccommodationOption[];
}>;
const accStep = employerSteps.find((s) => s.id === 'accommodations');
export const ACCOMMODATION_OPTIONS: AccommodationOption[] = accStep?.options ?? [];

export const JOBS_LIST: LocalizedJob[] = (jobsData as unknown as { jobs: LocalizedJob[] }).jobs ?? [];

export function SelectedJobBanner({
  lang,
  selectedJob,
  onBackToListings,
}: {
  lang: Lang;
  selectedJob: LocalizedJob | null;
  onBackToListings: () => void;
}): React.JSX.Element {
  return (
    <div className="op-selected-job-banner" role="region" aria-label={c('jobFilter.applyingFor', lang)}>
      <div className="op-selected-job-info">
        <span className="op-selected-job-tag">{c('jobFilter.applyingFor', lang)}</span>
        <strong className="op-selected-job-title">
          {selectedJob ? t(selectedJob.title as any, lang) : c('jobFilter.title', lang)}
        </strong>
        {selectedJob && <span className="op-selected-job-company">@{selectedJob.company}</span>}
      </div>
      <button
        type="button"
        className="op-btn-chip op-btn-change-job"
        onClick={onBackToListings}
      >
        ← {c('jobFilter.backToListings', lang)}
      </button>
    </div>
  );
}

export function JobListingPage({
  lang,
  schema,
  onSelectJobAndApply,
}: {
  lang: Lang;
  schema: Schema;
  onSelectJobAndApply: (job: LocalizedJob) => void;
}): React.JSX.Element {
  const [selectedAccs, setSelectedAccs] = useState<string[]>([]);

  const toggleAcc = (accValue: string) => {
    setSelectedAccs((prev) =>
      prev.includes(accValue) ? prev.filter((v) => v !== accValue) : [...prev, accValue]
    );
  };

  const clearFilters = () => setSelectedAccs([]);

  // Client-side accommodation matching: Zero disability disclosure to servers or employers
  const matchedJobs = useMemo(() => {
    if (selectedAccs.length === 0) return JOBS_LIST;
    return JOBS_LIST.filter((job) =>
      selectedAccs.every((needed) => job.accommodations.includes(needed))
    );
  }, [selectedAccs]);

  const countMessage = c('jobFilter.matchesCount', lang).replace(
    '{count}',
    String(matchedJobs.length)
  );

  const speechText = `${c('jobFilter.toggle', lang)}. ${c('jobFilter.privacy', lang)}. ${countMessage}.`;

  return (
    <section className="op-job-listing-page" aria-labelledby="op-q-title">
      <div className="op-job-listing-header">
        <h1 id="op-q-title" className="op-h1 op-job-listing-h1">
          {c('jobFilter.toggle', lang)}
        </h1>
        <ReadAloudButton
          text={speechText}
          lang={lang}
          schema={schema}
        />
      </div>

      {/* Privacy Guarantee Banner: No Disability Disclosure */}
      <div className="op-job-filter-privacy-card" role="note">
        <p className="op-privacy-text">{c('jobFilter.privacy', lang)}</p>
      </div>

      {/* Accommodation Checkbox Filters */}
      <fieldset className="op-job-filter-fieldset">
        <legend className="op-job-filter-legend">{c('jobFilter.title', lang)}</legend>
        <div className="op-job-filter-chips">
          {ACCOMMODATION_OPTIONS.map((opt) => {
            const isChecked = selectedAccs.includes(opt.value);
            const label = t(opt.label as any, lang);
            return (
              <label
                key={opt.value}
                data-acc-value={opt.value}
                className={`op-job-filter-chip ${isChecked ? 'op-chip-active' : ''}`}
              >
                <input
                  type="checkbox"
                  className="op-filter-checkbox"
                  value={opt.value}
                  checked={isChecked}
                  onChange={() => toggleAcc(opt.value)}
                />
                <span className="op-chip-label">{label}</span>
              </label>
            );
          })}
        </div>
        {selectedAccs.length > 0 && (
          <button
            type="button"
            className="op-btn-link op-filter-clear-btn"
            onClick={clearFilters}
          >
            {c('jobFilter.clear', lang)}
          </button>
        )}
      </fieldset>

      {/* Live announcer for screen reader feedback */}
      <div role="status" aria-live="polite" className="op-sr-only">
        {countMessage}
      </div>

      <div className="op-job-results-count" aria-hidden="true">
        {countMessage}
      </div>

      {/* Matched Job Cards */}
      <div className="op-job-cards-list">
        {matchedJobs.length === 0 ? (
          <div className="op-no-jobs-card">
            <p>{c('jobFilter.noMatches', lang)}</p>
            <button
              type="button"
              className="op-btn-secondary"
              onClick={clearFilters}
            >
              {c('jobFilter.all', lang)}
            </button>
          </div>
        ) : (
          matchedJobs.map((job) => (
            <article key={job.id} className="op-job-card">
              <div className="op-job-card-main">
                <h2 className="op-job-title">
                  {t(job.title as any, lang)}
                </h2>
                <div className="op-job-meta">
                  <span className="op-job-company">{job.company}</span>
                  <span className="op-job-bullet" aria-hidden="true">·</span>
                  <span className="op-job-location">
                    {t(job.location as any, lang)}
                  </span>
                </div>
                <p className="op-job-desc">
                  {t(job.description as any, lang)}
                </p>
                <div className="op-job-accommodations" aria-label="Offered accommodations">
                  {job.accommodations.map((accVal) => {
                    const opt = ACCOMMODATION_OPTIONS.find((o) => o.value === accVal);
                    const isMatched = selectedAccs.includes(accVal);
                    const accName = opt ? t(opt.label as any, lang) : accVal;
                    return (
                      <span
                        key={accVal}
                        className={`op-acc-badge ${isMatched ? 'op-acc-matched' : ''}`}
                        title={accName}
                      >
                        <span>{accName}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="op-job-card-action">
                <button
                  type="button"
                  className="op-btn op-btn-primary op-btn-apply"
                  onClick={() => onSelectJobAndApply(job)}
                >
                  {c('jobFilter.applyForThis', lang)}
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Action to proceed to register / apply */}
      <div className="op-nav op-job-listing-footer">
        <button
          type="button"
          className="op-btn op-btn-primary op-btn-continue"
          onClick={() => onSelectJobAndApply(matchedJobs[0] || JOBS_LIST[0])}
        >
          {c('jobFilter.nextToRegister', lang)}
        </button>
      </div>
    </section>
  );
}
