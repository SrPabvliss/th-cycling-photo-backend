import csv, numpy as np, collections
S='/private/tmp/claude-501/-Users-pablov-dev-titantv-eswa-paper/5b08cb81-fbfd-415b-a598-d4bab3514b75/scratchpad'
rows=[r for r in csv.DictReader(open(f'{S}/imgstats.tsv'),delimiter='\t') if r['included']=='t']
order=["lost line","2da.","cevallos","lumbis","ecuador open","pimampiro","3ra.","sigchos","el bosque","shimano","telef"]
short=dict(zip(order,["Lost Line","Coto","Cevallos","Lumbisí","Ecuador OPEN","Pimampiro","Pamba","Sigchos","El Bosque","SHIMANO","Teleférico"]))
by=collections.defaultdict(list)
for r in rows:
    for k in order:
        if k in r['event'].lower(): by[k].append(r); break
def q(v,p): return np.percentile(v,p) if len(v) else float('nan')
def f(v,d=0): return f"{v:.{d}f}".replace('.',',')
print("| Evento | n | Luminancia (IQR) | Contraste | % quemado | % sombra | Nitidez (IQR) | Saturación | Alto placa / alto foto % | Ancho/alto placa (IQR) | Centro placa, altura % |")
print("|---|---:|---|---:|---:|---:|---|---:|---:|---|---:|")
for k in order:
    g=by[k]; n=len(g)
    L=[float(r['luma']) for r in g]; C=[float(r['contrast']) for r in g]; hi=[float(r['pct_hi']) for r in g]; lo=[float(r['pct_lo']) for r in g]
    sh=[float(r['sharp']) for r in g]; sa=[float(r['sat']) for r in g]
    ph=[float(r['plate_h_rel'])*100 for r in g if r['plate_h_rel']]; pa=[float(r['plate_aspect']) for r in g if r['plate_aspect']]; cy=[float(r['plate_cy'])*100 for r in g if r['plate_cy']]
    print(f"| {short[k]} | {n} | {f(q(L,50))} ({f(q(L,25))}–{f(q(L,75))}) | {f(q(C,50))} | {f(q(hi,50),1)} | {f(q(lo,50),1)} | {f(q(sh,50))} ({f(q(sh,25))}–{f(q(sh,75))}) | {f(q(sa,50))} | {f(q(ph,50),1)} | {f(q(pa,50),2)} ({f(q(pa,25),2)}–{f(q(pa,75),2)}) | {f(q(cy,50))} |")
