/*
Github module for https://github.com/eisnerd/feedback-tool

You need a personal token that will be used both as a reporter user and to upload screenshot
images. Steps:

  - Create a specific github user.
  - Create a project (i.e.) snapshots to store images.
  - Create a personal token:
    - User -> Settings -> Developer Settings -> Personal access tokens -> Generate new token
    - Description: Upload screenshots for feedback.js
    - Select scopes: repo -> public_repo.
    - Generate token.

This token should be kept secret, outside of any public repository. If that's too much of a
hassle, it should be encoded somehow in the source. That's not secure (anyone could take
it and upload files to our snapshot repo), but at least you won't get it automatically
revoked by github.

Usage:

  $.feedbackGithub({
    token: "PERSONAL_TOKEN" | ["PERSONAL_", "TOKEN"],
    createIssue: true,
    postFunction: ({title, body}) => { },
    username: "USERNAME",
    issues: {
      repository: "ORG/PROJECT_WHERE_ISSUES_WILL_BE_CREATED",
      title: "[User feedback] {title}",
      body: "## Some report\n{body}",
    },
    snapshots: {
      repository: "ORG2/PROJECT_WHERE_SNAPSHOTS_WILL_BE_UPLOADED_TO",
      branch: "master",
    },
    feedbackOptions: {},
  });
*/

function interpolate(template, namespace) {
    return template.replace(/{([^{}]*)}/g,
        function (a, b) {
            var r = namespace[b];
            return typeof r === 'string' || typeof r === 'number' ? r : a;
        }
    );
};

class FeedBackToolGithub {
  constructor(options) {
    this.options = options;
    this.token = typeof options.token === "string" ? options.token : options.token.join("");
  }
  
  init() {
    $.feedback(Object.assign({}, {
      postFunction: this._sendReport.bind(this),
    }, this.options.feedbackOptions || {}));
  }
  
  _setAuthHeader(xhr) {
    xhr.setRequestHeader("Authorization", "token " + this.token);
  }
  
  _sendReport(data) {
    // data.post.img = "data:image/png;base64,iVBORw0KG..."
    const imgBase64 = data.post.img.split(",")[1];
    const uid = new Date().getTime() + parseInt(Math.random() * 1e6).toString();
    const postFunction = this.options.postFunction || (() => {});
     
    return this._uploadFile("screenshot-" + uid + ".png", imgBase64)
      .then(url =>
        this._getPayload(data, url))
      .then(payload => {
        if (this.options.createIssue) {
          this._postIssue(payload).then(postFunction);
        } else {
          postFunction(payload);
        }
      })
      .then(data.success, data.error);
  }

  _uploadFile(filename, contents) {
    const payload = {
      "message": "feedback.js snapshot",
      "branch": this.options.snapshots.branch,
      "content": contents,
    };
    
    return $.ajax({
      url: 'https://api.github.com/repos/' + this.options.snapshots.repository + '/contents/' + filename,
      type: "PUT",
      beforeSend: this._setAuthHeader.bind(this),
      dataType: 'json',
      data: JSON.stringify(payload),
    }).then(res => res.content.download_url);
  }

  _getPayload(data, screenshotUrl) {
    const info = data.post;
    const browser = info.browser;
    const body = [
      "## Browser",
      "- Name: " + browser.appCodeName,
      "- Version: " + browser.appVersion,
      "- Platform: " + browser.platform,
      "",
      "## User report",
      "URL: " + info.url,
      "",
      info.note,
      "",
      "![See screenshot here]( " + screenshotUrl + " )",
    ].join("\n");
    const bodyNamespace = {body, username: this.options.username};

    return {
      "title": interpolate(this.options.issues.title, {title: info.title}),
      "body": this.options.issues.body ? interpolate(this.options.issues.body, bodyNamespace) : body,
    };
  }

  _postIssue(payload) {
    return $.ajax({
      type: "POST",
      url: 'https://api.github.com/repos/' + this.options.issues.repository + '/issues',
      beforeSend: this._setAuthHeader.bind(this),
      dataType: 'json',
      data: JSON.stringify(payload),
    }).then(res => {
      return Object.assign(payload, {issueURL: res.html_url});
    });
  }
}

$.feedbackGithub = function(options) {
  const feedBackToolGithub = new FeedBackToolGithub(options);
  feedBackToolGithub.init();
  return feedBackToolGithub;
}