-- Quick metrics per run, provisional reference = current production bibs
-- (photo_bibs not deleted). Operating thresholds fixed here only for a first
-- look: detection 0.25, abstention on confidence_uncalibrated 0.70.
-- Usage: psql ... -v det=0.25 -v ocr=0.70 -f scripts/eval/metrics.sql


with ref as (
  select p.id as photo_id, coalesce(array_agg(distinct b.digits) filter (where b.digits is not null), '{}') as digits
  from photos p
  left join photo_bibs pb on pb.photo_id = p.id and pb.deleted_at is null
  left join lateral (select pb.digits) b on true
  group by p.id
),
pred as (
  select rb.run_id, rb.photo_id,
         array_agg(distinct rb.digits) filter (where rb.bbox_confidence >= :det and rb.confidence_uncalibrated >= :ocr and rb.digits <> '') as read,
         bool_or(rb.bbox_confidence >= :det) as detected
  from eval.run_bibs rb
  group by rb.run_id, rb.photo_id
),
per_photo as (
  select rp.run_id, rp.photo_id,
         coalesce(pr.detected, false) as detected,
         coalesce(pr.read, '{}') as read,
         r.digits as truth,
         cardinality(r.digits) > 0 as has_bib
  from eval.run_photos rp
  join ref r on r.photo_id = rp.photo_id
  left join pred pr on pr.run_id = rp.run_id and pr.photo_id = rp.photo_id
  where rp.status = 'ok'
)
select ru.id, ru.detector || '+' || ru.ocr as combo,
       count(*) as photos,
       count(*) filter (where has_bib) as with_bib,
       round(100.0 * count(*) filter (where has_bib and detected) / nullif(count(*) filter (where has_bib), 0), 1) as det_recall,
       round(100.0 * count(*) filter (where has_bib and detected) / nullif(count(*) filter (where detected), 0), 1) as det_precision,
       round(100.0 * count(*) filter (where has_bib and read = truth) / nullif(count(*) filter (where has_bib), 0), 1) as e2e_exact,
       round(100.0 * count(*) filter (where has_bib and read <> '{}' and read <> truth) / nullif(count(*) filter (where has_bib), 0), 1) as e2e_wrong,
       round(100.0 * count(*) filter (where has_bib and detected and read = '{}') / nullif(count(*) filter (where has_bib), 0), 1) as abstained,
       round(100.0 * count(*) filter (where not has_bib and read <> '{}') / nullif(count(*) filter (where not has_bib), 0), 1) as fp_on_no_bib
from per_photo pp
join eval.runs ru on ru.id = pp.run_id
group by ru.id, ru.detector, ru.ocr
order by ru.id;

select ru.id, ru.detector || '+' || ru.ocr as combo,
       count(*) filter (where not cold) as n,
       round(avg(decode_ms) filter (where not cold)::numeric, 0) as decode_avg,
       round((percentile_cont(0.5) within group (order by detection_ms) filter (where not cold))::numeric, 0) as det_p50,
       round((percentile_cont(0.95) within group (order by detection_ms) filter (where not cold))::numeric, 0) as det_p95,
       round((percentile_cont(0.5) within group (order by ocr_ms) filter (where not cold and ocr_ms > 0))::numeric, 1) as ocr_p50,
       round((percentile_cont(0.95) within group (order by ocr_ms) filter (where not cold and ocr_ms > 0))::numeric, 1) as ocr_p95,
       round((percentile_cont(0.5) within group (order by total_ms) filter (where not cold))::numeric, 0) as total_p50,
       count(distinct container_id) as containers,
       count(*) filter (where rp.status = 'error') as errors
from eval.run_photos rp
join eval.runs ru on ru.id = rp.run_id
group by ru.id, ru.detector, ru.ocr
order by ru.id;
