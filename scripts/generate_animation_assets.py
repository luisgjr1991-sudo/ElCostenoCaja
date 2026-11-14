from PIL import Image, ImageFilter, ImageChops
from pathlib import Path
from collections import deque

# Original separate artworks uploaded to GitHub, not masks of the combined logo.
HAT = Path("file_000000000fd88212acf472681773094b.webp")
LETTERS = Path("file_000000008f108212899a8afbba97be76.webp")
out = Path("app/src/main/assets")
out.mkdir(parents=True, exist_ok=True)

def transparent_art(path):
    im = Image.open(path).convert("RGBA")
    alpha = im.getchannel("A")
    if alpha.getextrema()[0] < 240:
        return im
    # The uploaded hat has a baked checkerboard preview. Separate its
    # solid outlined silhouette by detecting non-neutral/dark pixels,
    # closing the outline and filling its enclosed interior.
    im.thumbnail((1100, 1100), Image.Resampling.LANCZOS)
    rgb = im.convert("RGB")
    w, h = im.size
    px = rgb.load()
    seed = Image.new("L", (w, h), 0)
    sp = seed.load()
    for y in range(h):
        for x in range(w):
            R,G,B = px[x,y]
            if max(R,G,B)-min(R,G,B) > 26 or min(R,G,B) < 90:
                sp[x,y] = 255
    outline = seed.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.MinFilter(15))
    op = outline.load()
    seen = bytearray(w*h)
    q = deque()
    for x in range(w):
        for y in (0,h-1):
            k=y*w+x
            if not seen[k] and op[x,y]==0:seen[k]=1;q.append((x,y))
    for y in range(h):
        for x in (0,w-1):
            k=y*w+x
            if not seen[k] and op[x,y]==0:seen[k]=1;q.append((x,y))
    while q:
        x,y=q.popleft()
        for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if 0<=nx<w and 0<=ny<h:
                k=ny*w+nx
                if not seen[k] and op[nx,ny]==0:
                    seen[k]=1;q.append((nx,ny))
    mask=Image.new("L",(w,h),0); mp=mask.load()
    for y in range(h):
        for x in range(w):
            if not seen[y*w+x]:mp[x,y]=255
    mask=mask.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(.8))
    im.putalpha(mask)
    return im

hat=transparent_art(HAT)
letters=transparent_art(LETTERS)
# Normalize to the same 1536x1024 canvas so the runtime can animate
# them as separate layers with identical transform origins.
canvas=(1536,1024)
body=Image.new("RGBA",canvas,(0,0,0,0))
letters.thumbnail((1430,780),Image.Resampling.LANCZOS)
body.alpha_composite(letters,((canvas[0]-letters.width)//2,235))
hat_canvas=Image.new("RGBA",canvas,(0,0,0,0))
hat.thumbnail((1000,610),Image.Resampling.LANCZOS)
hat_canvas.alpha_composite(hat,((canvas[0]-hat.width)//2,0))
body.save(out/"logo_body_animation.png",compress_level=1)
hat_canvas.save(out/"logo_hat_animation.png",compress_level=1)
print("Using independently uploaded hat and lettering assets")
