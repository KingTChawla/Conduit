package com.conduit.modules

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.LocationManager
import android.net.wifi.WifiManager
import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pGroup
import android.net.wifi.p2p.WifiP2pManager
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.conduit.BuildConfig
import com.conduit.service.ConduitForegroundService

class WifiDirectModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "WifiDirectModule"
        const val TAG = "Conduit_WifiDirect"
    }

    private var manager: WifiP2pManager? = null
    private var channel: WifiP2pManager.Channel? = null
    private var receiver: BroadcastReceiver? = null
    private val handler = Handler(Looper.getMainLooper())

    init {
        manager = reactApplicationContext.getSystemService(Context.WIFI_P2P_SERVICE) as? WifiP2pManager
        initChannel()
        registerReceiver()
    }

    override fun getName() = NAME

    private fun initChannel() {
        channel?.close()
        channel = manager?.initialize(reactApplicationContext, Looper.getMainLooper(), null)
        if (BuildConfig.DEBUG) Log.d(TAG, "Channel initialized: $channel")
    }

    private fun registerReceiver() {
        receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                when (intent.action) {
                    WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
                        manager?.requestGroupInfo(channel) { group ->
                            try {
                                if (group != null) {
                                    val params = Arguments.createMap()
                                    params.putInt("count", group.clientList.size)
                                    emit("onPeerConnected", params)
                                } else {
                                    emit("onGroupRemoved", null)
                                }
                            } catch (_: Exception) {}
                        }
                    }
                    WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
                        manager?.requestGroupInfo(channel) { group ->
                            try {
                                val params = Arguments.createMap()
                                params.putInt("count", group?.clientList?.size ?: 0)
                                emit("onPeerDisconnected", params)
                            } catch (_: Exception) {}
                        }
                    }
                }
            }
        }

        val filter = IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
        }
        reactApplicationContext.registerReceiver(receiver, filter)
    }

    private fun emit(event: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(event, params)
    }

    @ReactMethod
    fun addListener(eventType: String?) {}

    @ReactMethod
    fun removeListeners(count: Int?) {}

    @ReactMethod
    fun checkPrerequisites(promise: Promise) {
        val ctx = reactApplicationContext
        val wifiManager = ctx.getSystemService(Context.WIFI_SERVICE) as WifiManager
        val locationManager = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager

        val result = Arguments.createMap()
        result.putBoolean("wifiEnabled", wifiManager.isWifiEnabled)
        result.putBoolean("locationEnabled", locationManager.isLocationEnabled)
        result.putBoolean("p2pAvailable", manager != null)
        if (BuildConfig.DEBUG) Log.d(TAG, "prerequisites: wifi=${wifiManager.isWifiEnabled}, location=${locationManager.isLocationEnabled}, p2p=${manager != null}")
        promise.resolve(result)
    }

    @ReactMethod
    fun enableWifi(promise: Promise) {
        val intent = Intent(Settings.Panel.ACTION_WIFI)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactApplicationContext.startActivity(intent)
        promise.resolve(null)
    }

    @ReactMethod
    fun createGroup(ssid: String, passphrase: String, band: Int, promise: Promise) {
        val mgr = manager
        if (mgr == null) {
            promise.reject("UNAVAILABLE", "WifiP2pManager not available")
            return
        }

        val wifiManager = reactApplicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        if (!wifiManager.isWifiEnabled) {
            if (BuildConfig.DEBUG) Log.e(TAG, "WiFi is disabled - P2P cannot work")
            promise.reject("WIFI_DISABLED", "WiFi must be enabled for WiFi Direct to work")
            return
        }

        val groupBand = when (band) {
            5 -> WifiP2pConfig.GROUP_OWNER_BAND_5GHZ
            2 -> WifiP2pConfig.GROUP_OWNER_BAND_2GHZ
            else -> WifiP2pConfig.GROUP_OWNER_BAND_AUTO
        }
        if (BuildConfig.DEBUG) Log.d(TAG, "createGroup: band=$band (groupBand=$groupBand)")

        if (BuildConfig.DEBUG) Log.d(TAG, "createGroup: reinitializing channel")
        initChannel()
        val ch = channel ?: run {
            promise.reject("CHANNEL_INIT_FAILED", "Failed to initialize WifiP2p channel")
            return
        }

        val config = WifiP2pConfig.Builder()
            .setNetworkName("DIRECT-$ssid")
            .setPassphrase(passphrase)
            .setGroupOperatingBand(groupBand)
            .build()

        if (BuildConfig.DEBUG) Log.d(TAG, "createGroup: removing any stale group first")
        ConduitForegroundService.registerCleanup {
            try { mgr.removeGroup(ch, null) } catch (_: Exception) {}
        }
        mgr.removeGroup(ch, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                if (BuildConfig.DEBUG) Log.d(TAG, "removeGroup OK, waiting 1s before create")
                handler.postDelayed({ doCreateGroup(mgr, ch, config, ssid, passphrase, promise, 0) }, 1000)
            }
            override fun onFailure(reason: Int) {
                if (BuildConfig.DEBUG) Log.d(TAG, "removeGroup failed (reason=$reason), trying create directly")
                doCreateGroup(mgr, ch, config, ssid, passphrase, promise, 0)
            }
        })
    }

    private fun doCreateGroup(
        mgr: WifiP2pManager,
        ch: WifiP2pManager.Channel,
        config: WifiP2pConfig,
        ssid: String,
        passphrase: String,
        promise: Promise,
        attempt: Int
    ) {
        if (BuildConfig.DEBUG) Log.d(TAG, "createGroup attempt ${attempt + 1}")
        mgr.createGroup(ch, config, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                if (BuildConfig.DEBUG) Log.d(TAG, "createGroup SUCCESS")
                val result = Arguments.createMap()
                result.putString("ssid", "DIRECT-$ssid")
                result.putString("ip", "192.168.49.1")
                promise.resolve(result)
            }
            override fun onFailure(reason: Int) {
                val msg = when (reason) {
                    0 -> "ERROR"
                    1 -> "P2P_UNSUPPORTED"
                    2 -> "BUSY"
                    else -> "UNKNOWN($reason)"
                }
                if (BuildConfig.DEBUG) Log.e(TAG, "createGroup FAILED: $msg (attempt ${attempt + 1})")
                if (reason == 2 && attempt < 3) {
                    val delay = (attempt + 1) * 1500L
                    if (BuildConfig.DEBUG) Log.d(TAG, "Retrying in ${delay}ms...")
                    handler.postDelayed({
                        doCreateGroup(mgr, ch, config, ssid, passphrase, promise, attempt + 1)
                    }, delay)
                } else {
                    promise.reject("CREATE_GROUP_FAILED", "Failed: $msg (reason $reason)")
                }
            }
        })
    }

    @ReactMethod
    fun removeGroup(promise: Promise) {
        val mgr = manager
        val ch = channel
        if (mgr == null || ch == null) {
            promise.reject("UNAVAILABLE", "WifiP2pManager not available")
            return
        }
        mgr.removeGroup(ch, object : WifiP2pManager.ActionListener {
            override fun onSuccess() { promise.resolve(null) }
            override fun onFailure(reason: Int) {
                promise.reject("REMOVE_GROUP_FAILED", "Failed with reason: $reason")
            }
        })
    }

    @ReactMethod
    fun getGroupInfo(promise: Promise) {
        val mgr = manager
        val ch = channel
        if (mgr == null || ch == null) {
            promise.reject("UNAVAILABLE", "WifiP2pManager not available")
            return
        }
        mgr.requestGroupInfo(ch) { group: WifiP2pGroup? ->
            if (group == null) {
                promise.reject("NO_GROUP", "No active P2P group")
                return@requestGroupInfo
            }
            val result = Arguments.createMap()
            result.putString("ssid", group.networkName)
            result.putBoolean("isGroupOwner", group.isGroupOwner)
            result.putInt("clientCount", group.clientList.size)
            promise.resolve(result)
        }
    }

    override fun onCatalystInstanceDestroy() {
        handler.removeCallbacksAndMessages(null)
        receiver?.let {
            try { reactApplicationContext.unregisterReceiver(it) } catch (_: Exception) {}
        }
        channel?.close()
    }
}
