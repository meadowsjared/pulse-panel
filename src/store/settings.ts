import { defineStore } from 'pinia'
import { Settings } from '../../@types/electron-window'

interface State {
  outputDeviceId: string | null
}

export const useSettingsStore = defineStore('settings', {
  state: (): State => ({
    outputDeviceId: null,
  }),
  actions: {
    async getOutputDevices(): Promise<MediaDeviceInfo[]> {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter(device => device.kind === 'audiooutput')
    },
    async fetchOutputDeviceId(): Promise<string> {
      const electron: Settings = window.electron
      const outputDevice = await electron.readSetting('outputDeviceId')
      if (!outputDevice) {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput')
        const defaultDevice = audioOutputDevices.length > 0 ? audioOutputDevices[0].deviceId : 'default'
        await electron.saveSetting('outputDeviceId', defaultDevice)
        this.outputDeviceId = defaultDevice // default to the first device
      } else {
        this.outputDeviceId = outputDevice // use the saved device
      }
      return this.outputDeviceId || ''
    },
    async setOutputDeviceId(deviceId: string): Promise<boolean> {
      const electron: Settings = window.electron
      // Check if the device exists
      const devices = await navigator.mediaDevices.enumerateDevices()
      const device = devices.find(device => device.deviceId === deviceId)
      if (!device) {
        console.error('Device not found')
        return false
      }
      await electron.saveSetting('outputDeviceId', deviceId)
      this.outputDeviceId = deviceId
      return true
    },
  },
})
