import _ from 'lodash';

export function findProjectKey(jiraClient) {
  return jiraClient.listProjects()
    .then(projects => _.find(projects,
        project => project.name === jiraClient.projectName).key);
}

export let getEpicLinkField = _.memoize(
  function (jiraClient) {
    return jiraClient.listFields()
      .then(fields => {
        for(let i = 0; i < fields.length; i++) {
          if(fields[i].name === 'Epic Link') {
            return Promise.resolve(fields[i].id);
          }
        }
        return Promise.reject('Cannot find Epic Link Field.');
      });
  },
  function (jiraClient) {
    return jiraClient.host;
  }
);

export function findIssueLinkParentKey(issue) {
  let result = null;
  issue.fields.issuelinks.forEach(issueLink => {
    if(issueLink.type.name !== 'Relates') {
      return;
    }

    let linkDirection = null;

    if(issueLink.inwardIssue) {
      linkDirection = 'inwardIssue';
    }
    else if(issueLink.outwardIssue) {
      linkDirection = 'outwardIssue';
    }

    if(linkDirection && issueLink[linkDirection].fields.issuetype.name === 'Initiative') {
      result = issueLink[linkDirection].key;
    }
  });

  return result;
}

export let findParent = _.memoize(
  function (issue, jiraClient) {
    switch(issue.fields.issuetype.name) {
      case 'Sub-task':
      case 'Feature Defect':
        return jiraClient.findIssue(issue.fields.parent.key);

      case 'Story':
        if(issue.fields.issuelinks) {
          let parentKey = findIssueLinkParentKey(issue);

          if(parentKey) {
            return jiraClient.findIssue(parentKey);
          }
        }

        return getEpicLinkField(jiraClient)
          .then(linkField => {
            const epicIssueNumber = issue.fields[linkField];

            if (!epicIssueNumber) {
              return Promise.reject(`${issue.key} does not have an associated parent Initiative or Epic.`);
            }

            return jiraClient.findIssue(issue.fields[linkField]);
          });

      case 'Epic':
        let parentKey = findIssueLinkParentKey(issue);

        return parentKey ? jiraClient.findIssue(parentKey) : Promise.reject(`Cannot find initiative from Epic ${issue.key} in issue links. Initiative should be linked by 'relates to'.`);

      default:
        return Promise.reject(`${issue.fields.issuetype.name} should not have a parent.`);
    }
  },
  function (issue) {
    return JSON.stringify(issue);
  }
);
