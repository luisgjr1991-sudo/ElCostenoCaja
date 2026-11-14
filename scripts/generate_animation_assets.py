from PIL import Image, ImageDraw, ImageChops
from pathlib import Path
from io import BytesIO
p=Path("file_00000000a8b88212877a593c1893ae10.png")
im=Image.open(p).convert("RGBA")
w,h=im.size
mask=Image.new("L",(w,h),0)
d=ImageDraw.Draw(mask)
pts=[(.32,.19),(.40,.13),(.55,.04),(.76,.005),(.91,.01),(.99,.15),(.99,.28),(.97,.45),(.80,.42),(.59,.32),(.42,.26),(.32,.19)]
d.polygon([(round(x*w),round(y*h)) for x,y in pts],fill=255)
hat=im.copy();hat.putalpha(ImageChops.multiply(im.getchannel("A"),mask))
body=im.copy();body.putalpha(ImageChops.subtract(im.getchannel("A"),mask))
out=Path("app/src/main/assets");out.mkdir(parents=True,exist_ok=True)
hat.save(out/"logo_hat_animation.png",compress_level=0)
body.save(out/"logo_body_animation.png",compress_level=0)
print("Animation assets:",(out/"logo_hat_animation.png").stat().st_size,(out/"logo_body_animation.png").stat().st_size)
