import React, { useState, useMemo } from 'react';
import type { Lang } from './types';
import { c } from './copy';
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

const JOBS_LIST: LocalizedJob[] = (jobsData as unknown as { jobs: LocalizedJob[] }).jobs ?? [];

interface JobFilterProps {
  lang: Lang;
  selectedJob: LocalizedJob | null;
  onSelectJob: (job: LocalizedJob | null) => void;
  open: boolean;
  onToggleOpen: () => void;
}

export function JobAccommodationFilter({
  lang,
  selectedJob,
  onSelectJob,
  open,
  onToggleOpen,
}: JobFilterProps): React.JSX.Element {
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

  return (
    <section className="op-job-filter-wrapper" aria-labelledby="op-job-filter-heading">
      {/* Active Selected Job Banner (if a job is picked) */}
      {selectedJob && (
        <div className="op-selected-job-banner" role="region" aria-label={c('jobFilter.applyingFor', lang)}>
          <div className="op-selected-job-info">
            <span className="op-selected-job-tag">{c('jobFilter.applyingFor', lang)}</span>
            <strong className="op-selected-job-title">
              {selectedJob.title[lang] || selectedJob.title.en}
            </strong>
            <span className="op-selected-job-company">@{selectedJob.company}</span>
          </div>
          <button
            type="button"
            className="op-btn-chip op-btn-change-job"
            onClick={onToggleOpen}
            aria-expanded={open}
          >
            {open ? c('jobFilter.all', lang) : c('jobFilter.toggle', lang)}
          </button>
        </div>
      )}

      {/* Filter Toggle Button when no job is selected */}
      {!selectedJob && (
        <div className="op-job-filter-toggle-row">
          <button
            type="button"
            className="op-job-filter-toggle-btn"
            onClick={onToggleOpen}
            aria-expanded={open}
            aria-controls="op-job-filter-panel"
          >
            <span>{c('jobFilter.toggle', lang)}</span>
            <span className="op-job-filter-badge">{matchedJobs.length}</span>
          </button>
        </div>
      )}

      {/* Expandable Filter & Matching Panel */}
      {open && (
        <div id="op-job-filter-panel" className="op-job-filter-panel">
          <div className="op-job-filter-header">
            <h2 id="op-job-filter-heading" className="op-job-filter-title">
              {c('jobFilter.title', lang)}
            </h2>
            {selectedAccs.length > 0 && (
              <button
                type="button"
                className="op-btn-link op-filter-clear-btn"
                onClick={clearFilters}
              >
                {c('jobFilter.clear', lang)}
              </button>
            )}
          </div>

          {/* Privacy Guarantee Banner: No Disability Disclosure */}
          <div className="op-job-filter-privacy-card" role="note">
            <p className="op-privacy-text">{c('jobFilter.privacy', lang)}</p>
          </div>

          {/* Accommodation Checkbox Filters */}
          <fieldset className="op-job-filter-fieldset">
            <legend className="op-sr-only">{c('jobFilter.title', lang)}</legend>
            <div className="op-job-filter-chips">
              {ACCOMMODATION_OPTIONS.map((opt) => {
                const isChecked = selectedAccs.includes(opt.value);
                const label = opt.label[lang] || opt.label.en;
                return (
                  <label
                    key={opt.value}
                    className={`op-job-filter-chip ${isChecked ? 'op-chip-active' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="op-filter-checkbox"
                      checked={isChecked}
                      onChange={() => toggleAcc(opt.value)}
                    />
                    <span className="op-chip-label">{label}</span>
                  </label>
                );
              })}
            </div>
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
              matchedJobs.map((job) => {
                const isCurrent = selectedJob?.id === job.id;
                return (
                  <article
                    key={job.id}
                    className={`op-job-card ${isCurrent ? 'op-job-card-active' : ''}`}
                  >
                    <div className="op-job-card-main">
                      <h3 className="op-job-title">
                        {job.title[lang] || job.title.en}
                      </h3>
                      <div className="op-job-meta">
                        <span className="op-job-company">{job.company}</span>
                        <span className="op-job-bullet" aria-hidden="true">·</span>
                        <span className="op-job-location">
                          {job.location[lang] || job.location.en}
                        </span>
                      </div>
                      <p className="op-job-desc">
                        {job.description[lang] || job.description.en}
                      </p>
                      <div className="op-job-accommodations" aria-label="Offered accommodations">
                        {job.accommodations.map((accVal) => {
                          const opt = ACCOMMODATION_OPTIONS.find((o) => o.value === accVal);
                          const isMatched = selectedAccs.includes(accVal);
                          const accName = opt ? opt.label[lang] || opt.label.en : accVal;
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
                        className={`op-btn ${isCurrent ? 'op-btn-current' : 'op-btn-primary'}`}
                        onClick={() => {
                          onSelectJob(job);
                          onToggleOpen();
                        }}
                      >
                        {c('jobFilter.applyForThis', lang)}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
}
