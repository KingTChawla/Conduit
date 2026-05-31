package com.conduit.modules

import android.content.Intent
import com.facebook.react.bridge.*
import com.conduit.service.ConduitForegroundService

class ForegroundServiceModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "ForegroundServiceModule"
    }

    override fun getName() = NAME

    @ReactMethod
    fun startService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, ConduitForegroundService::class.java)
            reactApplicationContext.startForegroundService(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("START_FAILED", e.message)
        }
    }

    @ReactMethod
    fun stopService(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, ConduitForegroundService::class.java)
            reactApplicationContext.stopService(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("STOP_FAILED", e.message)
        }
    }

    @ReactMethod
    fun updatePeerCount(count: Int) {
        ConduitForegroundService.peerCount = count
    }
}
