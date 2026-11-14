from PIL import Image, ImageDraw, ImageChops, ImageFilter
from pathlib import Path
p=Path("file_00000000a8b88212877a593c1893ae10.png")
im=Image.open(p).convert("RGBA")
w,h=im.size
# Hand-traced silhouette of the actual hat including the whole brim.
# Polygon is deliberately wider than the old diagonal cut.
points=[(.285,.16),(.31,.145),(.38,.14),(.49,.15),(.575,.145),(.605,.035),(.65,.012),(.71,.015),(.77,.08),(.82,.255),(.92,.32),(.975,.40),(.987,.49),(.975,.56),(.94,.60),(.875,.60),(.80,.56),(.72,.49),(.66,.425),(.59,.385),(.52,.38),(.46,.38),(.40,.40),(.35,.40),(.31,.375),(.285,.31)]
mask=Image.new("L",(w,h),0)
d=ImageDraw.Draw(mask)
d.polygon([(round(x*w),round(y*h)) for x,y in points],fill=255)
mask=mask.filter(ImageFilter.GaussianBlur(radius=1.2))
alpha=im.getchannel("A")
hat=im.copy();hat.putalpha(ImageChops.multiply(alpha,mask))
body=im.copy();body.putalpha(ImageChops.subtract(alpha,mask))
out=Path("app/src/main/assets");out.mkdir(parents=True,exist_ok=True)
hat.save(out/"logo_hat_animation.png",compress_level=0)
body.save(out/"logo_body_animation.png",compress_level=0)
print("Animation layers:",(out/"logo_hat_animation.png").stat().st_size,(out/"logo_body_animation.png").stat().st_size)
