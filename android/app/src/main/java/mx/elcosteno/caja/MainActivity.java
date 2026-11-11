package mx.elcosteno.caja;
import android.app.*;
import android.os.*;
import android.webkit.*;
import android.bluetooth.*;
import android.content.*;
import android.net.Uri;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
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
 });web.setWebViewClient(new WebViewClient());web.addJavascriptInterface(new Printer(),"AndroidPrinter");web.addJavascriptInterface(new PersistentStore(),"AndroidStorage");bluetooth=BluetoothAdapter.getDefaultAdapter();printerAddress=getPreferences(0).getString("printer","");web.loadUrl("file:///android_asset/index.html");}
 @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode==PICK_IMAGE_REQUEST&&pendingFiles!=null){Uri[] result=(resultCode==RESULT_OK&&data!=null&&data.getData()!=null)?new Uri[]{data.getData()}:null;pendingFiles.onReceiveValue(result);pendingFiles=null;}}
 public class PersistentStore {
  @JavascriptInterface public String get(String key){return getSharedPreferences("costeno_data",MODE_PRIVATE).getString(key,null);}
  @JavascriptInterface public void put(String key,String value){getSharedPreferences("costeno_data",MODE_PRIVATE).edit().putString(key,value).commit();}
  @JavascriptInterface public void remove(String key){getSharedPreferences("costeno_data",MODE_PRIVATE).edit().remove(key).commit();}
 }
 public class Printer {
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
