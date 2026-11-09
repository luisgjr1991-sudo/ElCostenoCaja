package mx.elcosteno.caja;

import android.Manifest;
import android.app.*;
import android.os.*;
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
    web = new WebView(this);
    web.getSettings().setJavaScriptEnabled(true);
    web.getSettings().setDomStorageEnabled(true);
    web.addJavascriptInterface(new PrinterBridge(), "AndroidPrinter");
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

  public class PrinterBridge {
    @JavascriptInterface public void downloadCutPdf(String json) { ui.post(() -> saveCutPdf(json)); }
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
  private void saveCutPdf(String json) {
    try {
      JSONObject c=new JSONObject(json);
      String stamp=new java.text.SimpleDateFormat("yyyyMMdd-HHmmss",Locale.US).format(new Date());
      String name="ElCosteno-Corte-"+stamp+".pdf";
      PdfDocument pdf=new PdfDocument();
      PdfDocument.PageInfo info=new PdfDocument.PageInfo.Builder(595,842,1).create();
      PdfDocument.Page page=pdf.startPage(info);
      Canvas canvas=page.getCanvas();Paint p=new Paint(3);p.setColor(Color.BLACK);p.setTextSize(13);
      int y=65;
      p.setTypeface(Typeface.create(Typeface.DEFAULT,Typeface.BOLD));p.setTextSize(21);
      canvas.drawText("EL COSTENO - CORTE DE CAJA",40,y,p);y+=38;
      p.setTypeface(Typeface.DEFAULT);p.setTextSize(12);
      canvas.drawText("Periodo: "+c.optString("label"),40,y,p);y+=23;
      canvas.drawText("Generado: "+new java.text.SimpleDateFormat("dd/MM/yyyy HH:mm",new Locale("es","MX")).format(new Date()),40,y,p);y+=28;
      canvas.drawText("Numero de ventas: "+c.optInt("count"),40,y,p);y+=25;
      canvas.drawText(String.format(Locale.US,"Subtotal: $%.2f",c.optDouble("subtotal")),40,y,p);y+=22;
      canvas.drawText(String.format(Locale.US,"IVA registrado: $%.2f",c.optDouble("tax")),40,y,p);y+=22;
      p.setTypeface(Typeface.create(Typeface.DEFAULT,Typeface.BOLD));p.setTextSize(16);
      canvas.drawText(String.format(Locale.US,"TOTAL: $%.2f",c.optDouble("amount")),40,y,p);y+=40;
      p.setTypeface(Typeface.create(Typeface.DEFAULT,Typeface.BOLD));p.setTextSize(13);
      canvas.drawText("Desglose por producto",40,y,p);y+=25;
      p.setTypeface(Typeface.DEFAULT);p.setTextSize(11);
      JSONArray lines=c.optJSONArray("lines");
      if(lines!=null)for(int i=0;i<lines.length();i++){
        if(y>790){canvas.drawText("Continua en reporte CSV si hay mas productos",40,y,p);break;}
        JSONObject x=lines.getJSONObject(i);
        String product=x.optString("name").replaceAll("[\\r\\n]"," ");
        if(product.length()>42)product=product.substring(0,42);
        canvas.drawText(product+"  x"+x.optInt("qty"),40,y,p);
        canvas.drawText(String.format(Locale.US,"$%.2f",x.optDouble("amount")),460,y,p);y+=21;
      }
      pdf.finishPage(page);
      android.content.ContentValues values=new android.content.ContentValues();
      values.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME,name);
      values.put(android.provider.MediaStore.MediaColumns.MIME_TYPE,"application/pdf");
      values.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS+"/ElCosteno");
      android.net.Uri uri=getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);
      if(uri==null)throw new IOException("No se pudo crear archivo");
      try(OutputStream out=getContentResolver().openOutputStream(uri)){if(out==null)throw new IOException("No se pudo abrir archivo");pdf.writeTo(out);}
      pdf.close();
      toast("PDF guardado en Descargas/ElCosteno");
      Intent share=new Intent(Intent.ACTION_SEND);
      share.setType("application/pdf");share.putExtra(Intent.EXTRA_STREAM,uri);share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      startActivity(Intent.createChooser(share,"Enviar corte a la contadora"));
    } catch(Exception e){toast("Error al generar PDF: "+e.getMessage());}
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
      for(String line:safe.split("\\n",-1)) {
        StringBuilder wrap=new StringBuilder();
        for(String word:line.split(" ")) {
          if(wrap.length()+word.length()+1>32) {out.write((wrap.toString()+"\n").getBytes(Charset.forName("US-ASCII")));wrap.setLength(0);}
          if(wrap.length()>0)wrap.append(' ');
          wrap.append(word);
        }
        out.write((wrap.toString()+"\n").getBytes(Charset.forName("US-ASCII")));
      }
      out.write(new byte[]{10});
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
  @Override public void onBackPressed() { if(web.canGoBack())web.goBack();else super.onBackPressed(); }
}
