package mx.elcosteno.caja;
import android.app.*;
import android.os.*;
import android.webkit.*;
import android.bluetooth.*;
import android.content.*;
import java.io.*;
import java.util.*;
public class MainActivity extends Activity {
 WebView web;
 BluetoothAdapter bluetooth;
 String printerAddress="";
 @Override public void onCreate(Bundle b){super.onCreate(b);web=new WebView(this);setContentView(web);web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.getSettings().setAllowFileAccess(true);web.setWebChromeClient(new WebChromeClient());web.setWebViewClient(new WebViewClient());web.addJavascriptInterface(new Printer(),"AndroidPrinter");bluetooth=BluetoothAdapter.getDefaultAdapter();printerAddress=getPreferences(0).getString("printer","");web.loadUrl("file:///android_asset/index.html");}
 public class Printer {
  @JavascriptInterface public void choosePrinter(){runOnUiThread(()->{if(bluetooth==null){status("Bluetooth no disponible");return;}try{ArrayList<BluetoothDevice> devices=new ArrayList<>(bluetooth.getBondedDevices());if(devices.isEmpty()){status("Vincula primero la impresora en Ajustes Bluetooth");return;}String[] names=new String[devices.size()];for(int i=0;i<devices.size();i++)names[i]=devices.get(i).getName()+" ("+devices.get(i).getAddress()+")";new AlertDialog.Builder(MainActivity.this).setTitle("Impresora Bluetooth").setItems(names,(d,which)->{printerAddress=devices.get(which).getAddress();getPreferences(0).edit().putString("printer",printerAddress).apply();status("Impresora seleccionada: "+names[which]);}).show();}catch(Exception e){status("Error Bluetooth: "+e.getMessage());}});}
  @JavascriptInterface public void printTicket(String ticket){send(ticket);}
  @JavascriptInterface public void printTicketWithLogo(String ticket,String logo){send(ticket);}
  private void send(String ticket){new Thread(()->{if(bluetooth==null||printerAddress.isEmpty()){status("Selecciona la impresora Bluetooth");return;}BluetoothSocket socket=null;try{BluetoothDevice device=bluetooth.getRemoteDevice(printerAddress);socket=device.createRfcommSocketToServiceRecord(UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"));bluetooth.cancelDiscovery();socket.connect();OutputStream out=socket.getOutputStream();out.write(new byte[]{27,64});out.write(ticket.getBytes("CP850"));out.write(new byte[]{10,10,10});out.flush();status("Ticket enviado a impresora");}catch(Exception e){status("Error de impresión: "+e.getMessage());}finally{try{if(socket!=null)socket.close();}catch(Exception ignored){}}}).start();}
 }
 void status(String s){runOnUiThread(()->web.evaluateJavascript("window.printerStatusUpdate("+orgJson(s)+")",null));}
 String orgJson(String s){return "\""+s.replace("\\","\\\\").replace("\"","\\\"").replace("\n"," ")+"\"";}
}
