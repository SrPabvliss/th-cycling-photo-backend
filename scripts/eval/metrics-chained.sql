-- Chained run (2026-10-02): accuracy and time per pair against the reviewed
-- reference (eval.dataset_photos / eval.ground_truth_bibs loaded from
-- decisiones.csv). Only photos that are reviewed and included count; photos
-- marked bib_visible_unreadable are reported apart (unreadable column).
--
-- Accuracy per photo: the set of digits read equals the reference set.
-- Operating thresholds: detection :det (bbox confidence), reader abstention
-- :ocr on the uncalibrated confidence (0 = keep every reading).
-- Usage: psql ... -v det=0.25 -v ocr=0 -v lo=28 -v hi=47 -f scripts/eval/metrics-chained.sql

create temp table if not exists tmp_pairs as
select ru.id as run_id, substr(ru.label, 12, 1) as account, ru.detector || '+' || ru.ocr as pair
from eval.runs ru where ru.id between :lo and :hi;

create temp table tmp_per_photo as
with ref as (
  select dp.photo_id, dp.event_id, dp.included, dp.bib_visible_unreadable,
         coalesce((select array_agg(g.digits order by g.digits) from eval.ground_truth_bibs g where g.photo_id = dp.photo_id), '{}') as truth
  from eval.dataset_photos dp
),
pred as (
  select rb.run_id, rb.photo_id,
         coalesce(array_agg(distinct rb.digits order by rb.digits) filter (where rb.bbox_confidence >= :det and coalesce(rb.confidence_uncalibrated, rb.confidence) >= :ocr and rb.digits <> ''), '{}') as read,
         bool_or(rb.bbox_confidence >= :det) as detected
  from eval.run_bibs rb
  join tmp_pairs tp on tp.run_id = rb.run_id
  group by rb.run_id, rb.photo_id
)
select tp.account, tp.pair, rp.run_id, rp.photo_id, r.event_id,
       r.bib_visible_unreadable as unreadable,
       coalesce(pr.detected, false) as detected,
       coalesce(pr.read, '{}') as read,
       r.truth,
       cardinality(r.truth) > 0 as has_bib,
       rp.cold, rp.decode_ms, rp.detection_ms,
       (rp.response->'timings'->>'detection_model_ms')::real as model_ms,
       rp.preprocess_ms, rp.ocr_ms, rp.total_ms, rp.http_ms
from eval.run_photos rp
join tmp_pairs tp on tp.run_id = rp.run_id
join ref r on r.photo_id = rp.photo_id and r.included
left join pred pr on pr.run_id = rp.run_id and pr.photo_id = rp.photo_id
where rp.status = 'ok';

\echo
\echo '== Exactitud por par (fotos revisadas e incluidas; ilegibles aparte) =='
select pair,
       count(*) filter (where not unreadable) as photos,
       count(*) filter (where has_bib) as with_bib,
       round(100.0 * count(*) filter (where not unreadable and read = truth) / nullif(count(*) filter (where not unreadable), 0), 1) as photo_exact,
       round(100.0 * count(*) filter (where has_bib and read = truth) / nullif(count(*) filter (where has_bib), 0), 1) as exact_with_bib,
       round(100.0 * count(*) filter (where has_bib and detected) / nullif(count(*) filter (where has_bib), 0), 1) as det_recall,
       round(100.0 * count(*) filter (where has_bib and read <> '{}' and read <> truth) / nullif(count(*) filter (where has_bib), 0), 1) as wrong_read,
       round(100.0 * count(*) filter (where has_bib and read = '{}') / nullif(count(*) filter (where has_bib), 0), 1) as missed,
       round(100.0 * count(*) filter (where not has_bib and not unreadable and read <> '{}') / nullif(count(*) filter (where not has_bib and not unreadable), 0), 1) as false_read_no_bib,
       count(*) filter (where unreadable) as unreadable,
       round(100.0 * count(*) filter (where unreadable and read <> '{}') / nullif(count(*) filter (where unreadable), 0), 1) as read_on_unreadable
from tmp_per_photo
group by pair order by pair;

\echo
\echo '== Exactitud por evento y par (fotos con dorsal) =='
select e.name as event, pair,
       count(*) filter (where has_bib) as with_bib,
       round(100.0 * count(*) filter (where has_bib and read = truth) / nullif(count(*) filter (where has_bib), 0), 1) as exact_with_bib
from tmp_per_photo pp join events e on e.id = pp.event_id
group by e.name, e.start_date, pair order by e.start_date, pair;

\echo
\echo '== Tiempo por foto y par, ms (sin frías): servicio, decodificación, detección (biblioteca + red), red sola, OCR =='
select pair, count(*) filter (where not cold) as n,
       round((percentile_cont(0.5) within group (order by total_ms) filter (where not cold))::numeric, 0) as total_p50,
       round((percentile_cont(0.95) within group (order by total_ms) filter (where not cold))::numeric, 0) as total_p95,
       round((percentile_cont(0.5) within group (order by decode_ms) filter (where not cold))::numeric, 0) as decode_p50,
       round((percentile_cont(0.5) within group (order by detection_ms) filter (where not cold))::numeric, 0) as det_p50,
       round((percentile_cont(0.5) within group (order by model_ms) filter (where not cold))::numeric, 1) as model_p50,
       round((percentile_cont(0.5) within group (order by detection_ms - model_ms) filter (where not cold))::numeric, 0) as det_lib_pre_p50,
       round((percentile_cont(0.5) within group (order by ocr_ms) filter (where not cold and ocr_ms > 0))::numeric, 1) as ocr_p50,
       round((percentile_cont(0.5) within group (order by http_ms) filter (where not cold))::numeric, 0) as http_p50
from tmp_per_photo
group by pair order by pair;

\echo
\echo '== Diferencia pareada por foto frente a producción (yolo+parseq), ms, mediana [p25, p75] del total_ms =='
with prod as (select photo_id, total_ms from tmp_per_photo where pair = 'yolo+parseq' and not cold)
select pp.pair, count(*) as n,
       round((percentile_cont(0.5) within group (order by pp.total_ms - prod.total_ms))::numeric, 0) as delta_p50,
       round((percentile_cont(0.25) within group (order by pp.total_ms - prod.total_ms))::numeric, 0) as delta_p25,
       round((percentile_cont(0.75) within group (order by pp.total_ms - prod.total_ms))::numeric, 0) as delta_p75
from tmp_per_photo pp join prod on prod.photo_id = pp.photo_id
where pp.pair <> 'yolo+parseq' and not pp.cold
group by pp.pair order by pp.pair;

\echo
\echo '== Tiempo por cuenta (host) y par: total_ms p50 =='
select account, pair, count(*) as n,
       round((percentile_cont(0.5) within group (order by total_ms) filter (where not cold))::numeric, 0) as total_p50,
       round((percentile_cont(0.5) within group (order by decode_ms) filter (where not cold))::numeric, 0) as decode_p50
from tmp_per_photo group by account, pair order by account, pair;

drop table tmp_per_photo;
drop table tmp_pairs;
