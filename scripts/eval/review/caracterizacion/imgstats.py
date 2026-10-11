import sys, os, csv, numpy as np
from PIL import Image, ImageFilter
S=sys.argv[1]; CACHE=os.path.expanduser('~/thesis/review-cache')
out=open(f'{S}/imgstats.tsv','w')
out.write('photo_id\tevent\tincluded\tunreadable\tW\tH\tluma\tcontrast\tpct_hi\tpct_lo\tsharp\tcolorful\tsat\tplate_h_rel\tplate_aspect\tplate_cy\tplate_cx\n')
for i,l in enumerate(open(f'{S}/photos_boxes.tsv')):
    pid,eid,ev,inc,unr,boxes=l.rstrip('\n').split('\t')
    p=f'{CACHE}/{eid}/{pid}.jpg'
    if not os.path.exists(p): continue
    im=Image.open(p); W,H=im.size
    s=im.convert('RGB'); s.thumbnail((480,480)); a=np.asarray(s).astype(np.float32)
    g=0.299*a[...,0]+0.587*a[...,1]+0.114*a[...,2]
    lap=np.asarray(Image.fromarray(g.astype(np.uint8)).filter(ImageFilter.Kernel((3,3),[0,1,0,1,-4,1,0,1,0],scale=1,offset=128))).astype(np.float32)-128
    rg=a[...,0]-a[...,1]; yb=0.5*(a[...,0]+a[...,1])-a[...,2]
    colorful=np.sqrt(rg.std()**2+yb.std()**2)+0.3*np.sqrt(rg.mean()**2+yb.mean()**2)
    hsv=np.asarray(s.convert('HSV')).astype(np.float32)
    ph=pa=cy=cx=''
    if boxes:
        bs=[list(map(float,b.split(','))) for b in boxes.split('|') if b]
        b=max(bs,key=lambda b:(b[2]-b[0])*(b[3]-b[1]))
        bw=(b[2]-b[0])*W; bh=(b[3]-b[1])*H
        ph=f'{bh/H:.4f}'; pa=f'{bw/bh:.3f}'; cy=f'{(b[1]+b[3])/2:.3f}'; cx=f'{(b[0]+b[2])/2:.3f}'
    out.write(f'{pid}\t{ev}\t{inc}\t{unr}\t{W}\t{H}\t{g.mean():.1f}\t{g.std():.1f}\t{(g>245).mean()*100:.2f}\t{(g<15).mean()*100:.2f}\t{lap.var():.1f}\t{colorful:.1f}\t{hsv[...,1].mean():.1f}\t{ph}\t{pa}\t{cy}\t{cx}\n')
    if i%2000==0: print(i, flush=True)
out.close()
