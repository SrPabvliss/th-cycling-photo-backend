-- Per-photo outcome of every pair in a run range, for the paired bootstrap
-- (scripts/eval/bootstrap_chained.py). Same definitions as metrics-chained.sql:
-- reviewed and included photos; detection threshold per detector (validation
-- max-F1, production its deployed one, :det for any other), reader abstention :ocr.
-- Usage: OUT=/tmp/x.csv psql ... -v lo=28 -v hi=63 -v det=0.25 -v dfine=0.5 -v ocr=0 -f scripts/eval/export-per-photo.sql
create temp table tmp_pairs as
select ru.id as run_id, (regexp_match(ru.label, '\m(?:abl-|opt-)?([A-F])\M'))[1] as account, case when ru.label like '%abl-%' then 'abl' when ru.label like '%opt-%' then 'opt' else 'main' end as series, ru.label, ru.detector || '+' || ru.ocr as pair, ru.detector, ru.ocr
from eval.runs ru where ru.id between :lo and :hi and ru.label like 'encadenado%';  -- series letter A-F = Modal account and container lineage; 'muestra' runs excluded

create temp table tmp_thr (detector text primary key, thr real);
insert into tmp_thr values ('yolo26m_1024', 0.55), ('rfdetr_l_896', 0.50), ('yolo11m_1024_fx', 0.35), ('dfine_l_640', :dfine), ('yolo', 0.25), ('yolo26m_c5_1024', 0.45), ('rfdetr_l_896_c5', 0.65);

create temp table tmp_per_photo as
with ref as (
  select dp.photo_id, dp.event_id, dp.included, dp.bib_visible_unreadable,
         coalesce((select array_agg(g.digits order by g.digits) from eval.ground_truth_bibs g where g.photo_id = dp.photo_id), '{}') as truth
  from eval.dataset_photos dp
),
pred as (
  select rb.run_id, rb.photo_id,
         coalesce(array_agg(distinct rb.digits order by rb.digits) filter (where rb.bbox_confidence >= coalesce(t.thr, :det) and coalesce(rb.confidence_uncalibrated, rb.confidence) >= :ocr and rb.digits <> ''), '{}') as read,
         bool_or(rb.bbox_confidence >= coalesce(t.thr, :det)) as detected
  from eval.run_bibs rb
  join tmp_pairs tp on tp.run_id = rb.run_id
  left join tmp_thr t on t.detector = tp.detector
  group by rb.run_id, rb.photo_id
)
select tp.account, tp.account || '/' || tp.series as host, tp.label, tp.pair, tp.detector, tp.ocr, rp.run_id, rp.photo_id, e.name as event,
       r.bib_visible_unreadable as unreadable,
       coalesce(pr.detected, false) as detected,
       array_to_string(coalesce(pr.read, '{}'), ' ') as read,
       array_to_string(r.truth, ' ') as truth,
       cardinality(r.truth) > 0 as has_bib,
       (coalesce(pr.read, '{}') = r.truth) as exact,
       rp.cold, rp.decode_ms, rp.detection_ms,
       (rp.response->'timings'->>'detection_model_ms')::real as model_ms,
       rp.preprocess_ms, rp.ocr_ms, rp.total_ms, rp.http_ms
from eval.run_photos rp
join tmp_pairs tp on tp.run_id = rp.run_id
join ref r on r.photo_id = rp.photo_id and r.included
join events e on e.id = r.event_id
left join pred pr on pr.run_id = rp.run_id and pr.photo_id = rp.photo_id
where rp.status = 'ok';

\copy tmp_per_photo to PROGRAM 'cat > "$OUT"' with (format csv, header)
