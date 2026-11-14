from pathlib import Path
p=Path("index.html")
s=p.read_text()
old="if(window.AndroidCashAudio&&soundSettings.vibration){try{window.AndroidCashAudio.play(kind+':'+(soundSettings.style||'classic'),0,true)}catch(e){}}"
new="if(window.AndroidCashAudio){try{window.AndroidCashAudio.play(kind+':'+(soundSettings.style||'classic'),soundSettings.enabled?Number(soundSettings.volume):0,!!soundSettings.vibration);return}catch(e){console.warn('Android audio unavailable',e)}}"
assert old in s, "Audio hook not found"
s=s.replace(old,new)
old="original.style.visibility='';body.style.transform=''"
assert old in s
s=s.replace(old,"original.style.visibility='';original.style.display='';body.style.transform=''")
old="original.style.visibility='hidden';stage.classList.add('active')"
assert old in s
s=s.replace(old,"original.style.visibility='hidden';original.style.display='none';stage.classList.add('active')")
# Prevent header from rendering while animated layers are on screen.
s=s.replace("body.logo-idle-playing.welcome-arrived #headerLogo{opacity:0!important;visibility:hidden!important}","body.logo-idle-playing.welcome-arrived #headerLogo{opacity:0!important;visibility:hidden!important;display:none!important}")
p.write_text(s)
print("Patched cash sounds and animated logo visibility")
