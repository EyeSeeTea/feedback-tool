/*
Dhis2+Github module for https://github.com/eisnerd/feedback-tool

Requires FeedBackToolGithub
*/

var groupBy = function(xs, fn) {
  return xs.reduce(function(rv, x) {
    (rv[fn(x)] = rv[fn(x)] || []).push(x);
    return rv;
  }, {});
};

class FeedBackToolDhis2 {
  constructor(d2, appKey, options) {
    this.d2 = d2;
    this.appKey = appKey;
    this.options = options;
  }
  
  init() {
    const locale = this.d2.currentUser.userSettings.settings.keyUiLocale || "en";
    const throwError = (msg) => { throw new Error(msg); };
    const init = i18nProperties => {
        $.feedbackGithub(Object.assign({}, this.options, {
            postFunction: this.sendFeedbackToUserGroups.bind(this),
            feedbackOptions: {i18nProperties},
        }));
    };

    fetch(`includes/feedback-tool/i18n/${locale}.properties`, {credentials: 'same-origin'})
        .then(res => res.status.toString().match(/^2..$/) ? res : throwError("Cannot find locale"))
        .then(res => res.text())
        .then(init).catch(() => init());
  }

  sendFeedbackToUserGroups(payload) {
      const userGroupNames = this.options.sendToDhis2UserGroups;
      const {title, body} = payload;
      const currentApp = this.d2.system.installedApps.find(app => app.key === this.appKey);
      const fullTitle = currentApp ? `[${currentApp.name}] ${title}` : title;
      const fullBody = payload.issueURL ? `${body}\n\n---\n${payload.issueURL}` : body;

      return this.getUserGroups(userGroupNames)
          .then(userGroups => this.sendMessage(fullTitle, fullBody, userGroups.toArray()))
          .catch(err => { alert("Cannot send dhis2 message"); });
  }

  getUserGroups(names) {
      return this.d2.models.userGroups.list({
          filter: "name:in:[" + names.join(",") + "]",
          paging: false,
      });
  }

  sendMessage(subject, text, recipients) {
      const api = this.d2.Api.getApi();
      const recipientsByModel = groupBy(recipients, recipient => recipient.modelDefinition.name);
      const ids = (objs) => objs && objs.map(obj => ({id: obj.id}));

      const message = {
          subject: subject,
          text: text,
          users: ids(recipientsByModel.user),
          userGroups: ids(recipientsByModel.userGroup),
          organisationUnits: ids(recipientsByModel.organisationUnit),
      };

      if (recipients.length == 0) {
          return Promise.resolve();
      } else {
          return api.post("/messageConversations", message);
      }
  }
}

$.feedbackDhis2 = function(d2, appKey, options) {
  const feedBackToolDhis2 = new FeedBackToolDhis2(d2, appKey, options);
  feedBackToolDhis2.init();
  return feedBackToolDhis2;
}