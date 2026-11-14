from PIL import Image, ImageDraw, ImageChops
from pathlib import Path
from io import BytesIO
p=Path("file_00000000a8b88212877a593c1893ae10.png")
im=Image.open(p).convert("RGBA")
w,h=im.size
mask=Image.new("L",(w,h),0)
d=ImageDraw.Draw(mask)
# Trace the complete brim, including the 'DE CANASTA' lettering; do not cut through it.
# Coordinates are normalized to the source image (500 x 333 reference).
pts=[(.30,.16),(.38,.13),(.50,.13),(.59,.12),(.65,.035),(.72,.005),(.79,.025),(.85,.10),(.88,.17),(.93,.23),(.97,.33),(.98,.42),(.95,.51),(.90,.57),(.83,.59),(.74,.55),(.65,.49),(.58,.45),(.50,.43),(.42,.42),(.35,.40),(.30,.34),(.29,.25)]
d.polygon([(round(x*w),round(y*h)) for x,y in pts],fill=255)
hat=im.copy();hat.putalpha(ImageChops.multiply(im.getchannel("A"),mask))
body=im.copy();body.putalpha(ImageChops.subtract(im.getchannel("A"),mask))
out=Path("app/src/main/assets");out.mkdir(parents=True,exist_ok=True)
hat.save(out/"logo_hat_animation.png",compress_level=0)
body.save(out/"logo_body_animation.png",compress_level=0)
print("Animation assets:",(out/"logo_hat_animation.png").stat().st_size,(out/"logo_body_animation.png").stat().st_size)
