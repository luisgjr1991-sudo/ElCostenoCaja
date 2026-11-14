package mx.elcosteno.caja;

import android.Manifest;
import android.app.*;
import android.os.*;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.bluetooth.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.pm.ShortcutManager;
import android.content.pm.ShortcutInfo;
import android.graphics.drawable.Icon;
import android.webkit.*;
import android.net.Uri;
import android.webkit.ValueCallback;
import android.widget.*;
import java.io.OutputStream;
import java.nio.charset.Charset;
import java.util.*;
import android.graphics.*;
import android.graphics.pdf.PdfDocument;
import android.os.Environment;
import java.io.*;
import org.json.*;

public class MainActivity extends Activity {
  private WebView web;
  private ValueCallback<Uri[]> fileChooserCallback;
  private static final int FILE_PICKER_REQUEST=202;
  private final Handler ui = new Handler(Looper.getMainLooper());
  private static final String PREF = "printer";
  private static final int BT_PERMISSION = 101;
  private final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

  @Override public void onCreate(Bundle b) {
    super.onCreate(b);
    audioThread.start(); audioHandler = new Handler(audioThread.getLooper());
    web = new WebView(this);
    web.getSettings().setJavaScriptEnabled(true);
    web.getSettings().setDomStorageEnabled(true);
    web.addJavascriptInterface(new PrinterBridge(), "AndroidPrinter");
    web.addJavascriptInterface(new CashAudioBridge(), "AndroidCashAudio");
    web.setWebChromeClient(new WebChromeClient() {
      @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
        if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
        fileChooserCallback = callback;
        try {
          Intent intent = params.createIntent();
          intent.addCategory(Intent.CATEGORY_OPENABLE);
          startActivityForResult(intent, FILE_PICKER_REQUEST);
          return true;
        } catch (Exception e) {
          fileChooserCallback = null;
          callback.onReceiveValue(null);
          toast("No se pudo abrir la galeria: "+e.getMessage());
          return true;
        }
      }
    });
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri=request.getUrl();String scheme=uri.getScheme();
        if("https".equals(scheme)||"http".equals(scheme)){
          try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception e){toast("No se pudo abrir WhatsApp");}return true;
        }
        return false;
      }
      @Override public void onPageFinished(WebView v, String url) { status("Impresora: " + getPreferences(0).getString(PREF, "sin seleccionar")); }
    });
    setContentView(web);
    web.loadUrl("file:///android_asset/index.html");
  }

  private boolean permission() {
    if (Build.VERSION.SDK_INT >= 31 && checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
      requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT}, BT_PERMISSION);
      return false;
    }
    return true;
  }
  private void status(String s) {
    ui.post(() -> web.evaluateJavascript("window.printerStatusUpdate && window.printerStatusUpdate(" + org.json.JSONObject.quote(s) + ")", null));
  }
  private void toast(String s) { ui.post(() -> Toast.makeText(this, s, Toast.LENGTH_LONG).show()); }

  private final HandlerThread audioThread = new HandlerThread("CostenoAudio");
  private Handler audioHandler;
  private ToneGenerator cashTone;
  private int cashToneVolume=-1;
  private final Object cashAudioLock = new Object();
  private int cashSoundSequence = 0;
  private void playCashAudio(String kind, int volume, boolean vibration) {
    final String[] parts=kind.split(":");
    final String event=parts[0];
    final boolean modern=parts.length>1 && "modern".equals(parts[1]);
    audioHandler.post(() -> {
      if(vibration)try {
        android.os.Vibrator vib=(android.os.Vibrator)getSystemService(VIBRATOR_SERVICE);
        if(vib!=null && vib.hasVibrator())vib.vibrate(android.os.VibrationEffect.createOneShot("tap".equals(event)?15:65,android.os.VibrationEffect.DEFAULT_AMPLITUDE));
      }catch(Exception ignored){}
      if(volume<=0)return;
      synchronized(cashAudioLock) {
        cashSoundSequence++;
        final int sequence=cashSoundSequence;
        if(cashTone==null || cashToneVolume!=volume){
          try {if(cashTone!=null)cashTone.release();}catch(Exception ignored){}
          cashTone=new ToneGenerator(AudioManager.STREAM_MUSIC,Math.max(1,Math.min(100,volume)));
          cashToneVolume=volume;
        }
        final int[] notes;
        final int[] durations;
        switch(event){
          case "product":notes=modern?new int[]{ToneGenerator.TONE_DTMF_5,ToneGenerator.TONE_DTMF_8}:new int[]{ToneGenerator.TONE_PROP_BEEP2,ToneGenerator.TONE_PROP_ACK};durations=new int[]{60,65};break;
          case "navigate":notes=new int[]{modern?ToneGenerator.TONE_DTMF_2:ToneGenerator.TONE_PROP_BEEP};durations=new int[]{55};break;
          case "error":case "warning":notes=new int[]{ToneGenerator.TONE_PROP_NACK,ToneGenerator.TONE_PROP_NACK};durations=new int[]{100,115};break;
          case "success":notes=modern?new int[]{ToneGenerator.TONE_DTMF_9,ToneGenerator.TONE_DTMF_6,ToneGenerator.TONE_DTMF_3}:new int[]{ToneGenerator.TONE_PROP_BEEP2,ToneGenerator.TONE_PROP_ACK,ToneGenerator.TONE_PROP_ACK};durations=new int[]{85,115,210};break;
          default:notes=new int[]{modern?ToneGenerator.TONE_DTMF_1:ToneGenerator.TONE_PROP_BEEP};durations=new int[]{45};break;
        }
        int delay=0;
        for(int i=0;i<notes.length;i++){
          final int tone=notes[i],ms=durations[i];
          audioHandler.postDelayed(()->{synchronized(cashAudioLock){if(sequence==cashSoundSequence && cashTone!=null)try{cashTone.startTone(tone,ms);}catch(Exception ignored){}}},delay);
          delay+=ms+55;
        }
      }
    });
  }
  public class CashAudioBridge {
    @JavascriptInterface public void play(String kind,int volume,boolean vibration) {
      playCashAudio(kind,volume,vibration);
    }
  }

  public class PrinterBridge {
    @JavascriptInterface public void downloadCutPdf(String json) { ui.post(() -> saveCutPdf(json,false,"")); }
    @JavascriptInterface public void downloadAndShareCutPdf(String json,String number) { ui.post(() -> saveCutPdf(json,true,number)); }
    @JavascriptInterface public void choosePrinter() { ui.post(() -> selectPrinter()); }
    @JavascriptInterface public void createShortcut(String data) { ui.post(() -> pinShortcut(data)); }
    @JavascriptInterface public void printTicket(String content) { printTicketWithLogo(content, ""); }
    @JavascriptInterface public void printTicketWithLogo(String content, String logoData) {
      ui.post(() -> {
        if (!permission()) { toast("Autoriza Bluetooth y vuelve a pulsar Imprimir."); return; }
        String mac = getPreferences(0).getString(PREF, "");
        if (mac.isEmpty()) { selectPrinter(); toast("Selecciona la impresora y vuelve a pulsar Imprimir."); return; }
        new Thread(() -> send(mac, content, logoData)).start();
      });
    }
  }

  private void pinShortcut(String data) {
    try {
      ShortcutManager manager=getSystemService(ShortcutManager.class);
      if(manager==null || !manager.isRequestPinShortcutSupported()){
        toast("Tu pantalla de inicio no permite crear accesos directos desde la app.");
        return;
      }
      int comma=data.indexOf(',');
      if(comma<0)throw new IllegalArgumentException("Imagen no valida");
      byte[] raw=android.util.Base64.decode(data.substring(comma+1),android.util.Base64.DEFAULT);
      Bitmap source=BitmapFactory.decodeByteArray(raw,0,raw.length);
      if(source==null)throw new IllegalArgumentException("No se pudo abrir la imagen");
      int size=192;
      Bitmap icon=Bitmap.createBitmap(size,size,Bitmap.Config.ARGB_8888);
      Canvas canvas=new Canvas(icon);
      Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
      float scale=Math.min((size*0.9f)/source.getWidth(),(size*0.9f)/source.getHeight());
      float w=source.getWidth()*scale,h=source.getHeight()*scale;
      canvas.drawBitmap(source,null,new RectF((size-w)/2,(size-h)/2,(size+w)/2,(size+h)/2),paint);
      Intent launch=new Intent(this,MainActivity.class).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
      ShortcutInfo shortcut=new ShortcutInfo.Builder(this,"costeno-custom-"+System.currentTimeMillis())
        .setShortLabel("El Costeño Caja")
        .setLongLabel("El Costeño Caja")
        .setIcon(Icon.createWithBitmap(icon))
        .setIntent(launch)
        .build();
      boolean requested=manager.requestPinShortcut(shortcut,null);
      if(!requested)toast("No se pudo solicitar el acceso directo.");
      source.recycle();
    } catch(Exception e) {toast("Error al crear icono: "+e.getMessage());}
  }
  private void selectPrinter() {
    if (!permission()) return;
    BluetoothManager manager = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
    BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
    if (adapter == null) { toast("Este dispositivo no tiene Bluetooth."); return; }
    Set<BluetoothDevice> paired;
    try { paired = adapter.getBondedDevices(); } catch (SecurityException e) { toast("Falta permiso Bluetooth."); return; }
    if (paired.isEmpty()) { toast("Primero vincula la impresora en Ajustes Bluetooth de Android."); return; }
    ArrayList<BluetoothDevice> devices = new ArrayList<>(paired);
    String[] labels = new String[devices.size()];
    for (int i=0;i<devices.size();i++) labels[i]=devices.get(i).getName()+" ("+devices.get(i).getAddress()+")";
    new AlertDialog.Builder(this).setTitle("Impresora vinculada").setItems(labels, (d,which)-> {
      String mac=devices.get(which).getAddress();
      getPreferences(0).edit().putString(PREF,mac).apply();
      status("Impresora: "+labels[which]);
    }).setNegativeButton("Cancelar",null).show();
  }
  private void saveCutPdf(String json,boolean viaWhatsApp,String number) {
    PdfDocument pdf=new PdfDocument();
    try {
      JSONObject c=new JSONObject(json);
      String stamp=new java.text.SimpleDateFormat("yyyyMMdd-HHmmss",Locale.US).format(new Date());
      String name="ElCosteno-Corte-"+stamp+".pdf";
      Paint p=new Paint(3);p.setColor(Color.BLACK);
      PdfDocument.Page page=null;Canvas canvas=null;int y=0;int pageNo=0;
      JSONArray sales=c.optJSONArray("sales");
      java.util.TreeMap<String,java.util.ArrayList<JSONObject>> byDay=new java.util.TreeMap<>();
      if(sales!=null)for(int i=0;i<sales.length();i++){
        JSONObject sale=sales.getJSONObject(i);
        String date=sale.optString("date");
        String key=date.length()>=10?date.substring(0,10):"Sin fecha";
        try { Date d=new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss",Locale.US).parse(date);
          if(d!=null)key=new java.text.SimpleDateFormat("yyyy-MM-dd",Locale.US).format(d);
        }catch(Exception ignored){}
        if(!byDay.containsKey(key))byDay.put(key,new java.util.ArrayList<>());
        byDay.get(key).add(sale);
      }
      page=pdf.startPage(new PdfDocument.PageInfo.Builder(595,842,++pageNo).create());
      canvas=page.getCanvas();y=38;p.setTypeface(Typeface.DEFAULT_BOLD);p.setTextSize(17);
      canvas.drawText("EL COSTENO | REPORTE DE VENTAS",32,y,p);y+=23;
      p.setTypeface(Typeface.DEFAULT);p.setTextSize(10);
      canvas.drawText("Periodo: "+c.optString("label")+"  |  Ventas: "+c.optInt("count"),32,y,p);y+=17;
      canvas.drawText("Generado: "+new java.text.SimpleDateFormat("dd/MM/yyyy HH:mm",new Locale("es","MX")).format(new Date()),32,y,p);y+=19;
      canvas.drawText(String.format(Locale.US,"Subtotal $%.2f   IVA $%.2f   Ret. ISR $%.2f   TOTAL $%.2f",c.optDouble("subtotal"),c.optDouble("tax"),c.optDouble("retention"),c.optDouble("amount")),32,y,p);y+=22;
      for(java.util.Map.Entry<String,java.util.ArrayList<JSONObject>> entry:byDay.entrySet()){
        if(y>755){pdf.finishPage(page);page=pdf.startPage(new PdfDocument.PageInfo.Builder(595,842,++pageNo).create());canvas=page.getCanvas();y=40;}
        double dayTotal=0;for(JSONObject sale:entry.getValue())dayTotal+=sale.optDouble("amount");
        p.setTypeface(Typeface.DEFAULT_BOLD);p.setTextSize(11);
        canvas.drawText("FECHA: "+entry.getKey()+"  |  "+entry.getValue().size()+" ventas  |  Total: "+String.format(Locale.US,"$%.2f",dayTotal),32,y,p);y+=16;
        p.setTypeface(Typeface.DEFAULT);p.setTextSize(9);
        for(int group=0;group<2;group++){
          int groupCount=0;double groupTotal=0;
          for(JSONObject itemSale:entry.getValue())if(itemSale.optBoolean("invoice")== (group==1)){groupCount++;groupTotal+=itemSale.optDouble("amount");}
          if(y>745){pdf.finishPage(page);page=pdf.startPage(new PdfDocument.PageInfo.Builder(595,842,++pageNo).create());canvas=page.getCanvas();y=40;}
          p.setTypeface(Typeface.DEFAULT_BOLD);p.setTextSize(10);
          canvas.drawText((group==0?"VENTAS NORMALES":"VENTAS CON FACTURA")+"  |  "+groupCount+" tickets  |  $"+String.format(Locale.US,"%.2f",groupTotal),42,y,p);y+=17;
          p.setTypeface(Typeface.DEFAULT);p.setTextSize(9);
          for(JSONObject sale:entry.getValue()){
          if(sale.optBoolean("invoice")!=(group==1))continue;
          if(y>770){pdf.finishPage(page);page=pdf.startPage(new PdfDocument.PageInfo.Builder(595,842,++pageNo).create());canvas=page.getCanvas();y=40;}
          String folio=String.format(Locale.US,"%06d",sale.optInt("folio"));
          String time=sale.optString("date");try{Date parsed=new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss",Locale.US).parse(time);if(parsed!=null)time=new java.text.SimpleDateFormat("HH:mm",Locale.US).format(parsed);}catch(Exception ignored){}
          canvas.drawText("Folio "+folio+"  Hora: "+time+(sale.optBoolean("invoice")?" [FACTURA]":""),42,y,p);
          canvas.drawText(String.format(Locale.US,"$%.2f",sale.optDouble("amount")),480,y,p);y+=13;
          JSONArray items=sale.optJSONArray("items");
          if(items!=null)for(int j=0;j<items.length();j++){
            if(y>770){pdf.finishPage(page);page=pdf.startPage(new PdfDocument.PageInfo.Builder(595,842,++pageNo).create());canvas=page.getCanvas();y=40;}
            JSONObject item=items.getJSONObject(j);
            String product=item.optString("name").replaceAll("[\\r\\n]"," ");
            if(product.length()>48)product=product.substring(0,48);
            canvas.drawText("  "+item.optInt("qty")+" x "+product,52,y,p);
            canvas.drawText(String.format(Locale.US,"$%.2f",item.optInt("qty")*item.optDouble("price")),480,y,p);y+=12;
          }
          if(sale.optBoolean("invoice")){
            canvas.drawText(String.format(Locale.US,"Subtotal %.2f  |  IVA %.2f  |  Ret. ISR %.2f",sale.optDouble("subtotal"),sale.optDouble("tax"),sale.optDouble("retention")),52,y,p);y+=13;
          }
          }
        }
        y+=9;
      }
      if(y>710){pdf.finishPage(page);page=pdf.startPage(new PdfDocument.PageInfo.Builder(595,842,++pageNo).create());canvas=page.getCanvas();y=40;}
      p.setTypeface(Typeface.DEFAULT_BOLD);p.setTextSize(12);canvas.drawText("FACTURAS DEL PERIODO",32,y,p);y+=18;
      p.setTypeface(Typeface.DEFAULT);p.setTextSize(9);
      double invoiced=0,retained=0;int invoiceCount=0;
      if(sales!=null)for(int i=0;i<sales.length();i++){
        JSONObject sale=sales.getJSONObject(i);if(!sale.optBoolean("invoice"))continue;
        if(y>770){pdf.finishPage(page);page=pdf.startPage(new PdfDocument.PageInfo.Builder(595,842,++pageNo).create());canvas=page.getCanvas();y=40;}
        invoiceCount++;invoiced+=sale.optDouble("amount");retained+=sale.optDouble("retention");
        String date=sale.optString("date");if(date.length()>10)date=date.substring(0,10);
        canvas.drawText(date+"  Folio "+sale.optInt("folio")+"  Sub. "+String.format(Locale.US,"%.2f",sale.optDouble("subtotal"))+"  IVA "+String.format(Locale.US,"%.2f",sale.optDouble("tax"))+"  ISR "+String.format(Locale.US,"%.2f",sale.optDouble("retention")),38,y,p);
        canvas.drawText(String.format(Locale.US,"$%.2f",sale.optDouble("amount")),480,y,p);y+=15;
      }
      if(y>775){pdf.finishPage(page);page=pdf.startPage(new PdfDocument.PageInfo.Builder(595,842,++pageNo).create());canvas=page.getCanvas();y=40;}
      p.setTypeface(Typeface.DEFAULT_BOLD);canvas.drawText(String.format(Locale.US,"Facturas: %d  |  Total facturado: $%.2f  |  ISR retenido: $%.2f",invoiceCount,invoiced,retained),32,y,p);
      pdf.finishPage(page);
      android.content.ContentValues values=new android.content.ContentValues();
      values.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME,name);
      values.put(android.provider.MediaStore.MediaColumns.MIME_TYPE,"application/pdf");
      values.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS+"/ElCosteno");
      android.net.Uri uri=getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);
      if(uri==null)throw new IOException("No se pudo crear archivo");
      try(OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new IOException("No se pudo abrir archivo");pdf.writeTo(out);}
      toast("PDF guardado en Descargas/ElCosteno");
      if(viaWhatsApp){
        Intent share=new Intent(Intent.ACTION_SEND);
        share.setType("application/pdf");
        share.putExtra(Intent.EXTRA_STREAM,uri);
        share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        // WhatsApp does not guarantee automatic PDF delivery to a phone number.
        // Let the user choose and confirm the recipient before sending.
        try{
          share.setPackage("com.whatsapp");
          startActivity(share);
        }catch(android.content.ActivityNotFoundException missing){
          share.setPackage(null);
          startActivity(Intent.createChooser(share,"Seleccionar WhatsApp y destinatario"));
        }
        toast("Selecciona el chat del número guardado y confirma el envío.");
      }
    }catch(Exception e){toast("Error al generar PDF: "+e.getMessage());}
    finally{pdf.close();}
  }

  private void printLogo(OutputStream out,String data) throws Exception {
    int comma=data.indexOf(',');
    if(comma<0) return;
    byte[] raw=android.util.Base64.decode(data.substring(comma+1),android.util.Base64.DEFAULT);
    Bitmap original=BitmapFactory.decodeByteArray(raw,0,raw.length);
    if(original==null) return;
    int width=320;
    int height=Math.max(1,Math.min(180,Math.round(original.getHeight()*(width/(float)original.getWidth()))));
    Bitmap bitmap=Bitmap.createScaledBitmap(original,width,height,true);
    int bytesPerRow=width/8;
    byte[] row=new byte[bytesPerRow*height];
    for(int y=0;y<height;y++)for(int x=0;x<width;x++){
      int pixel=bitmap.getPixel(x,y);
      int alpha=Color.alpha(pixel);
      int luminance=(Color.red(pixel)*299+Color.green(pixel)*587+Color.blue(pixel)*114)/1000;
      if(alpha>100 && luminance<165)row[y*bytesPerRow+x/8]|=(byte)(0x80>>(x%8));
    }
    out.write(new byte[]{27,97,1});
    out.write(new byte[]{29,118,48,0,(byte)(bytesPerRow&255),(byte)(bytesPerRow>>8),(byte)(height&255),(byte)(height>>8)});
    out.write(row);out.write(new byte[]{27,97,0});
    bitmap.recycle();
    if(bitmap!=original)original.recycle();
  }
  private void send(String mac, String content, String logoData) {
    BluetoothSocket socket=null;
    try {
      BluetoothAdapter adapter=BluetoothAdapter.getDefaultAdapter();
      if(adapter==null) throw new Exception("Bluetooth no disponible");
      BluetoothDevice device=adapter.getRemoteDevice(mac);
      socket=device.createRfcommSocketToServiceRecord(SPP);
      // Android 12+ requires BLUETOOTH_SCAN for cancelDiscovery().
      // This app connects to an already paired printer, so discovery cancellation
      // is unnecessary and must not prevent printing.
      if (Build.VERSION.SDK_INT < 31) {
        try { adapter.cancelDiscovery(); } catch (SecurityException ignored) {}
      }
      socket.connect();
      OutputStream out=socket.getOutputStream();
      out.write(new byte[]{27,64,27,97,0}); // reset, align left
      if(logoData!=null && logoData.startsWith("data:image/")) {
        try { printLogo(out,logoData); } catch(Exception logoError) {
          toast("No se pudo imprimir el logo: "+logoError.getMessage());
        }
      }
      // CP850 is commonly supported by 58mm ESC/POS devices; accents transliterated for portability.
      String safe=java.text.Normalizer.normalize(content,java.text.Normalizer.Form.NFD)
        .replaceAll("\\p{M}+","").replace("ñ","n").replace("Ñ","N");
      // Preserve the 32-column alignment. Splitting by spaces caused unwanted wrapping
      // and wasted paper on the 58mm printer.
      for(String line:safe.split("\\n",-1)) {
        if(line.length()==0) { out.write(10); continue; }
        for(int start=0;start<line.length();start+=32) {
          String segment=line.substring(start,Math.min(start+32,line.length()));
          out.write(segment.getBytes(Charset.forName("US-ASCII")));
          out.write(10);
        }
      }
      // Feed the paper beyond the last printed message so it can be torn off cleanly.
      // ESC J n: advance paper by 160 dots (about 20 mm at 203 dpi) to keep the footer clear of the tear edge.
      // Feed AFTER printing the footer so the tear edge does not cut the text.
      out.write(new byte[]{27,74,(byte)160});
      out.flush();
      toast("Ticket enviado a la impresora.");
    } catch(Exception e) {toast("No se pudo imprimir: "+e.getMessage());}
    finally {if(socket!=null)try{socket.close();}catch(Exception ignored){}}
  }
  @Override protected void onActivityResult(int requestCode,int resultCode,Intent data) {
    super.onActivityResult(requestCode,resultCode,data);
    if(requestCode==FILE_PICKER_REQUEST && fileChooserCallback!=null) {
      Uri[] result=WebChromeClient.FileChooserParams.parseResult(resultCode,data);
      fileChooserCallback.onReceiveValue(result);
      fileChooserCallback=null;
    }
  }
  @Override protected void onDestroy() { synchronized(cashAudioLock) { if(cashTone!=null){cashTone.release();cashTone=null;} } super.onDestroy(); }
  @Override public void onBackPressed() { if(web.canGoBack())web.goBack();else super.onBackPressed(); }
}
