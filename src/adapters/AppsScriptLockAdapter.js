function createAppsScriptLockAdapter(lockProvider) {
  function resolveLock() {
    var lock;

    if (lockProvider && typeof lockProvider.tryLock === 'function') {
      return lockProvider;
    }

    if (typeof LockService !== 'undefined' && LockService && typeof LockService.getScriptLock === 'function') {
      lock = LockService.getScriptLock();
      if (lock && typeof lock.tryLock === 'function') {
        return lock;
      }
    }

    throw new Error('RUNTIME_LOCK_REQUIRED');
  }

  return {
    runExclusive: function(callback) {
      var lock = resolveLock();
      if (!lock.tryLock(30000)) {
        throw new Error('RUNTIME_LOCK_ACQUISITION_FAILED');
      }

      try {
        return callback();
      } finally {
        if (typeof lock.releaseLock === 'function') {
          lock.releaseLock();
        }
      }
    }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createAppsScriptLockAdapter };
}
