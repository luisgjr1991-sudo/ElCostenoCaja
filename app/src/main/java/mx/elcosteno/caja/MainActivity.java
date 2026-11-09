package mx.elcosteno.caja;

import android.Manifest;
import android.app.*;
import android.os.*;
import android.bluetooth.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.webkit.*;
import android.widget.*;
import java.io.OutputStream;
import java.nio.charset.Charset;
import java.util.*;

public class MainActivity extends Activity {
  private WebView web;
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
    @JavascriptInterface public void choosePrinter() { ui.post(() -> selectPrinter()); }
    @JavascriptInterface public void printTicket(String content) {
      ui.post(() -> {
        if (!permission()) { toast("Autoriza Bluetooth y vuelve a pulsar Imprimir."); return; }
        String mac = getPreferences(0).getString(PREF, "");
        if (mac.isEmpty()) { selectPrinter(); toast("Selecciona la impresora y vuelve a pulsar Imprimir."); return; }
        new Thread(() -> send(mac, content)).start();
      });
    }
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
  private void send(String mac, String content) {
    BluetoothSocket socket=null;
    try {
      BluetoothAdapter adapter=BluetoothAdapter.getDefaultAdapter();
      if(adapter==null) throw new Exception("Bluetooth no disponible");
      BluetoothDevice device=adapter.getRemoteDevice(mac);
      socket=device.createRfcommSocketToServiceRecord(SPP);
      adapter.cancelDiscovery();
      socket.connect();
      OutputStream out=socket.getOutputStream();
      out.write(new byte[]{27,64,27,97,0}); // reset, align left
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
      out.write(new byte[]{10,10,10});
      out.flush();
      toast("Ticket enviado a la impresora.");
    } catch(Exception e) {toast("No se pudo imprimir: "+e.getMessage());}
    finally {if(socket!=null)try{socket.close();}catch(Exception ignored){}}
  }
  @Override public void onBackPressed() { if(web.canGoBack())web.goBack();else super.onBackPressed(); }
}
