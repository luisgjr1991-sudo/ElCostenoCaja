package mx.elcosteno.caja;
import android.app.*;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.*;
import android.webkit.*;
import android.bluetooth.*;
import android.content.*;
import android.net.Uri;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.os.Environment;
import org.json.*;
import android.util.Base64;
import java.io.*;
import java.util.*;
public class MainActivity extends Activity {
 WebView web;
 BluetoothAdapter bluetooth;
 String printerAddress="";
 android.webkit.ValueCallback<Uri[]> pendingFiles;
 static final int PICK_IMAGE_REQUEST=7421;
 @Override public void onCreate(Bundle b){super.onCreate(b);web=new WebView(this);setContentView(web);web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.getSettings().setAllowFileAccess(true);web.setWebChromeClient(new WebChromeClient(){
  @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params){
   if(pendingFiles!=null)pendingFiles.onReceiveValue(null);
   pendingFiles=callback;
   try{Intent intent=new Intent(Intent.ACTION_GET_CONTENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("image/*");startActivityForResult(Intent.createChooser(intent,"Elegir imagen del logo"),PICK_IMAGE_REQUEST);return true;}
   catch(Exception e){pendingFiles=null;callback.onReceiveValue(null);return true;}
  }
 });web.setWebViewClient(new WebViewClient(){
  private boolean route(Uri uri) {
   if(uri==null)return false;
   String scheme=uri.getScheme();
   if("file".equalsIgnoreCase(scheme)||"about".equalsIgnoreCase(scheme))return false;
   try {
    Intent intent=new Intent(Intent.ACTION_VIEW,uri);
    if("whatsapp".equalsIgnoreCase(scheme))intent.setPackage("com.whatsapp");
    startActivity(intent);
   }catch(Exception e){toast("No se pudo abrir WhatsApp: "+e.getMessage());}
   return true;
  }
  @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request){return route(request.getUrl());}
  @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return route(Uri.parse(url));}
 });web.addJavascriptInterface(new Printer(),"AndroidPrinter");web.addJavascriptInterface(new PersistentStore(),"AndroidStorage");web.addJavascriptInterface(new CashAudio(),"AndroidCashAudio");bluetooth=BluetoothAdapter.getDefaultAdapter();printerAddress=getPreferences(0).getString("printer","");web.loadUrl("file:///android_asset/index.html");}
 @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode==PICK_IMAGE_REQUEST&&pendingFiles!=null){Uri[] result=(resultCode==RESULT_OK&&data!=null&&data.getData()!=null)?new Uri[]{data.getData()}:null;pendingFiles.onReceiveValue(result);pendingFiles=null;}}
 public class CashAudio {
  @JavascriptInterface public void play(String kind,int volume,boolean vibrate){
   runOnUiThread(()->{
    try{
     if(vibrate){android.os.Vibrator v=(android.os.Vibrator)getSystemService(VIBRATOR_SERVICE);if(v!=null&&v.hasVibrator())v.vibrate(85);}
     if(volume<=0)return;
     final ToneGenerator tone=new ToneGenerator(AudioManager.STREAM_MUSIC,Math.max(1,Math.min(100,volume)));
     int sound="error".equals(kind)?ToneGenerator.TONE_PROP_NACK:ToneGenerator.TONE_PROP_ACK;
     tone.startTone(sound,180);
     new Handler(Looper.getMainLooper()).postDelayed(()->{try{tone.release();}catch(Exception ignored){}},300);
    }catch(Exception ignored){}
   });
  }
 }
  private void toast(String message){runOnUiThread(()->android.widget.Toast.makeText(this,message,android.widget.Toast.LENGTH_LONG).show());}
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
        for(JSONObject sale:entry.getValue()){
          if(y>770){pdf.finishPage(page);page=pdf.startPage(new PdfDocument.PageInfo.Builder(595,842,++pageNo).create());canvas=page.getCanvas();y=40;}
          String folio=String.format(Locale.US,"%06d",sale.optInt("folio"));
          canvas.drawText("Folio "+folio+(sale.optBoolean("invoice")?" [FACTURA]":""),42,y,p);
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


 public class PersistentStore {
  @JavascriptInterface public String get(String key){return getSharedPreferences("costeno_data",MODE_PRIVATE).getString(key,null);}
  @JavascriptInterface public void put(String key,String value){getSharedPreferences("costeno_data",MODE_PRIVATE).edit().putString(key,value).commit();}
  @JavascriptInterface public void remove(String key){getSharedPreferences("costeno_data",MODE_PRIVATE).edit().remove(key).commit();}
 }
 public class Printer {
  @JavascriptInterface public void downloadCutPdf(String json){runOnUiThread(()->saveCutPdf(json,false,""));}
  @JavascriptInterface public void downloadAndShareCutPdf(String json,String number){runOnUiThread(()->saveCutPdf(json,true,number));}
  @JavascriptInterface public void choosePrinter(){runOnUiThread(()->{if(bluetooth==null){status("Bluetooth no disponible");return;}try{ArrayList<BluetoothDevice> devices=new ArrayList<>(bluetooth.getBondedDevices());if(devices.isEmpty()){status("Vincula primero la impresora en Ajustes Bluetooth");return;}String[] names=new String[devices.size()];for(int i=0;i<devices.size();i++)names[i]=devices.get(i).getName()+" ("+devices.get(i).getAddress()+")";new AlertDialog.Builder(MainActivity.this).setTitle("Impresora Bluetooth").setItems(names,(d,which)->{printerAddress=devices.get(which).getAddress();getPreferences(0).edit().putString("printer",printerAddress).apply();status("Impresora seleccionada: "+names[which]);}).show();}catch(Exception e){status("Error Bluetooth: "+e.getMessage());}});}
  @JavascriptInterface public String getDefaultTicketLogo(){try(InputStream in=getAssets().open("file_000000002e348212a1fdaa37bd6a866d.png");ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1)out.write(buf,0,n);return "data:image/png;base64,"+Base64.encodeToString(out.toByteArray(),Base64.NO_WRAP);}catch(Exception e){return "";}}
  @JavascriptInterface public void printTicket(String ticket){send(ticket);}
  @JavascriptInterface public void printTicketWithLogo(String ticket,String logo){send(ticket,logo);}
  private void send(String ticket){send(ticket,null);}
  private void send(String ticket,String logo){new Thread(()->{if(bluetooth==null||printerAddress.isEmpty()){status("Selecciona la impresora Bluetooth");return;}BluetoothSocket socket=null;try{BluetoothDevice device=bluetooth.getRemoteDevice(printerAddress);socket=device.createRfcommSocketToServiceRecord(UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"));bluetooth.cancelDiscovery();socket.connect();OutputStream out=socket.getOutputStream();out.write(new byte[]{27,64});if(logo!=null&&!logo.isEmpty())writeLogo(out,logo);out.write(ticket.getBytes("CP850"));out.write(new byte[]{10,10,10});out.flush();status("Ticket enviado a impresora");}catch(Exception e){status("Error de impresión: "+e.getMessage());}finally{try{if(socket!=null)socket.close();}catch(Exception ignored){}}}).start();}
 }
 void writeLogo(OutputStream out,String data) throws Exception {
  int comma=data.indexOf(',');String encoded=comma>=0?data.substring(comma+1):data;
  byte[] bytes=Base64.decode(encoded,Base64.DEFAULT);
  Bitmap original=BitmapFactory.decodeByteArray(bytes,0,bytes.length);
  if(original==null)return;
  int width=Math.min(384,original.getWidth());width=Math.max(8,(width/8)*8);
  int height=Math.max(1,Math.round(original.getHeight()*(width/(float)original.getWidth())));
  height=Math.min(height,350);
  Bitmap bitmap=Bitmap.createScaledBitmap(original,width,height,true);
  int bytesPerRow=width/8;
  out.write(new byte[]{27,97,1}); // centered
  out.write(new byte[]{29,118,48,0,(byte)(bytesPerRow&255),(byte)(bytesPerRow>>8),(byte)(height&255),(byte)(height>>8)});
  for(int y=0;y<height;y++)for(int bx=0;bx<bytesPerRow;bx++){
   int bits=0;
   for(int bit=0;bit<8;bit++){
    int pixel=bitmap.getPixel(bx*8+bit,y);
    int alpha=Color.alpha(pixel);
    int gray=(Color.red(pixel)*299+Color.green(pixel)*587+Color.blue(pixel)*114)/1000;
    if(alpha>90&&gray<165)bits|=128>>bit;
   }
   out.write(bits);
  }
  out.write(new byte[]{10,27,97,0});
  bitmap.recycle();
 }
 void status(String s){runOnUiThread(()->web.evaluateJavascript("window.printerStatusUpdate("+orgJson(s)+")",null));}
 String orgJson(String s){return "\""+s.replace("\\","\\\\").replace("\"","\\\"").replace("\n"," ")+"\"";}
}
