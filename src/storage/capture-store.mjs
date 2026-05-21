export function createMemoryCaptureStore(seed = []) {
  const events = [...seed]
  return {
    async writeCaptureEvent(event) {
      events.push(event)
      return event
    },
    async listCaptureEvents(filter = {}) {
      return events.filter((event) => {
        if (filter.category && event.category !== filter.category) return false
        if (filter.app_id && event.app_id !== filter.app_id) return false
        return true
      })
    }
  }
}
