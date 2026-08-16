const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const PublicationState = Object.freeze({
  PUBLISHED: 'published',
  TOMBSTONED: 'tombstoned',
  NOT_EMITTED: 'not-emitted'
});

function requireCalendarDate(value, fieldName) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw new TypeError(`${fieldName} must use YYYY-MM-DD`);
  }

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new TypeError(`${fieldName} must be a valid calendar date`);
  }

  return value;
}

export function localDateAt(instant, timezone) {
  if (!(instant instanceof Date) || Number.isNaN(instant.valueOf())) {
    throw new TypeError('instant must be a valid Date');
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(instant);

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function evaluatePublicationState(post, today) {
  const publishAfterDate = requireCalendarDate(post.publishAfterDate, 'publishAfterDate');
  const evaluationDate = requireCalendarDate(today, 'today');

  // FR-501 and FR-504 take precedence over deletion: never-published content
  // must leave no public artifact, even when its deletion date has passed.
  if (publishAfterDate > evaluationDate) {
    return PublicationState.NOT_EMITTED;
  }

  if (post.deleteDate != null) {
    const deleteDate = requireCalendarDate(post.deleteDate, 'deleteDate');
    if (deleteDate <= evaluationDate) {
      return PublicationState.TOMBSTONED;
    }
  }

  return PublicationState.PUBLISHED;
}
