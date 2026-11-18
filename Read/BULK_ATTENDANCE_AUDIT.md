# Bulk attendance audit

A read-only audit of the hosted HR database on 18 November 2026 found 2,109 identifiable standard-hours entries. Of those, 531 entries totaling 4,248 hours belong to three employees whose current roster status is Inactive.

| Employee ID | Entries | Hours | Attendance date range | Entry ID on 18 November 2026 |
| --- | ---: | ---: | --- | ---: |
| 34 | 177 | 1,416 | 12 March–18 November 2026 | 5956 |
| 36 | 177 | 1,416 | 12 March–18 November 2026 | 5950 |
| 37 | 177 | 1,416 | 12 March–18 November 2026 | 5951 |

The three rows dated on the audit day are the clearest review candidates because the roster showed all three employees as inactive that day. Each employee also has 161 of the identified entries created after the recorded attendance date. The roster has start dates and current statuses, and the audit trail contains no employment-status history for these employees. No identified entry predates its employee’s start date. The effective inactive dates are needed to determine which historical entries fall outside employment.

The audit used the application’s standard-fill signature of regular 09:00–17:00 attendance stamped with `Standard hours filled by admin:`. Another 18 rows have the default manual Admin Time Entry note. That note is also used when entering time for one employee, so it cannot establish whether those rows came from a batch. Custom notes can make other admin entries indistinguishable by source.

## Read-only lookup

```sql
SELECT e.id AS employee_id, te.id AS entry_id, te.date AS attendance_date,
       te.hours, te.created_at
FROM public.time_entries te
JOIN public.employees e ON e.id = te.employee_id
WHERE regexp_replace(lower(btrim(coalesce(e.status, ''))), '[[:space:]_-]+', '', 'g')
        IN ('inactive', 'terminated', 'former')
  AND te.hour_type = 'regular'
  AND te.clock_in = time '09:00'
  AND te.clock_out = time '17:00'
  AND te.notes LIKE 'Standard hours filled by admin:%'
ORDER BY e.id, te.date, te.id;
```

The new migration records future roster status transitions using Vietnam calendar dates. A status change applies from its recorded date, and the employee’s recorded start date is inclusive. An employee who is already inactive needs a recorded active period for historical bulk eligibility. The migration contains schema changes only.

The hosted catalog also lacks the approved-leave fill and cleanup triggers defined by the repository’s attendance migration. The new eligibility migration is verified locally with those leave rules installed. This audit made no hosted writes.
