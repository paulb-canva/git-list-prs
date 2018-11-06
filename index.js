#!/usr/bin/env node

const github = require('octonode');
const fs = require('fs');
const inquirer = require('inquirer');
const simpleGit = require('simple-git/promise');
const colors = require('colors');
const program = require('commander');
const package = require('./package.json');
const open = require('open');

async function main() {
  program.version(package.version).option('-r, --to-review', 'Show what I have to review');
  program.parse(process.argv);

  process.stdin.on('keypress', function(ch, key) {
    if (key && key.name === 'escape') {
      process.exit();
    }
  });

  const sg = simpleGit();

  const key = await sg.raw(['config', '--get', 'github.apiKey']);
  if (!key) {
    console.log('Github API key not found. Please run `git config github.apiKey <YOUR_GITHUB_API_KEY>`');
    process.exit(1);
  }
  const client = github.client(key.trim());
  const ghsearch = client.search();
  
  let ghNick = await sg.raw(['config', '--get', `github.user`]);
  if (!ghNick) {
    ghNick = (await client.me().infoAsync())[0].login;
    await sg.addConfig('github.user', ghNick);
  }
  ghNick = ghNick.trim();
  const remoteUrl = await sg.raw(['config', '--get', `remote.origin.url`]);
  const nickAndRepo = remoteUrl.match(/:(.*)\.git/)[1];

  const showMyToReview = program.toReview;

  const results = showMyToReview
    ? await ghsearch.issuesAsync({
        q: `state:open+repo:${nickAndRepo}+type:pr+review-requested:${ghNick}`,
        sort: 'updated',
        order: 'desc',
      })
    : await ghsearch.issuesAsync({
        q: `state:open+type:pr+author:${ghNick}`,
        sort: 'updated',
        order: 'desc',
      });
  
  if (!results[0].items.length) {
    console.log('No open PRs found, exiting.');
    process.exit(0);
  }

  const mapPr = item => ({
    title: item.title,
    number: item.number,
    head: item.head,
    author: item.user.login,
    url: item.pull_request.html_url
  });
  const pullRequests = results[0].items.map(item => mapPr(item));
  
  const getChoiceTitle = (pr, index) =>
    showMyToReview
      ? `[${index + 1}] ${pr.title} ${colors.italic('[from ' + pr.author + ']')}`
      : `[${index + 1}] ${pr.title}`;

  const getChoiceUrl = (pr, index) => pr.url

  const getChoices = prs => {
    return [].concat.apply([], prs.map((pr, index) => ([{
      name: getChoiceTitle(pr, index),
      value: pr,
    }, 
    {
      name: '  -> view ' + getChoiceUrl(pr, index),
      value: getChoiceUrl(pr, index)
    }])));
  };

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'pr',
      message: 'Select a PR to checkout',
      choices: getChoices(pullRequests),
      pageSize: 100,
    },
  ]);

  if (typeof answer.pr === 'string' && answer.pr.startsWith('http')) {
    console.log('Viewing pull request in browser');
    open(answer.pr);
    return;
  }
 
  const ghpr = client.pr(nickAndRepo, answer.pr.number);
  const prInfo = await ghpr.infoAsync();
  const headRef = prInfo[0].head.ref;
  if (showMyToReview) {
    console.log(`fetching ${headRef} from origin...`);
    await sg.fetch('origin', headRef);
  }
  console.log('Checking out', headRef);
  await sg.checkout(headRef);
  if (showMyToReview) {
    await sg.merge([`origin/${headRef}`, '--ff-only']);
  }
}

async function run() {
  try {
    await main();
  } catch (e) {
    console.log(e.message);
  }
}

run();
