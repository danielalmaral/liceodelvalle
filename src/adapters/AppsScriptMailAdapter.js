function createAppsScriptMailAdapter(provider) {
  function resolveProvider() {
    if (provider && typeof provider.sendEmail === 'function') {
      return provider;
    }

    if (typeof MailApp !== 'undefined' && MailApp && typeof MailApp.sendEmail === 'function') {
      return MailApp;
    }

    if (typeof GmailApp !== 'undefined' && GmailApp && typeof GmailApp.sendEmail === 'function') {
      return GmailApp;
    }

    throw new Error('MAIL_PROVIDER_REQUIRED');
  }

  return {
    send: function(message) {
      var mailProvider = resolveProvider();
      return mailProvider.sendEmail(message.to, message.subject, message.body);
    }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { createAppsScriptMailAdapter };
}
