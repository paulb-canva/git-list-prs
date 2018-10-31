# git list-prs

Tool to help you easily switch between your open PRs (or PRs you were asked to review).

### Installation
Run
```
npm i git-list-prs
```

Then in your repo run `git config github.apiKey <YOUR_GITHUB_API_KEY>` (you can get GH api key from [GitHub settings page](https://github.com/settings/tokens)).

### Usage
Run `git list-prs` to list your open PRs or `git list-prs -r` to list open PRs you're assigned as a reviewer to.

Selecting from the list will checkout the PR branch. If you're running with `-r` it will also fetch the branch from remote `origin` and will try to do a fast-forward merge to ensure you're on the most recent commit.
