# Expected State After Release

## Direct-master path

- [ ] `git push origin master` completed without errors
- [ ] CI `tag-on-merge.yml` triggered on the push
- [ ] After workflow runs: `v<version>` tag exists on remote (`git ls-remote --tags origin` shows the tag)
- [ ] After tag is created: `release.yml` packages `.vsix` and creates GitHub Release

## PR path

- [ ] Current feature/release branch pushed to remote
- [ ] A PR exists targeting `master` (`gh pr list --head <branch> --base master` shows an open PR)
- [ ] PR title is `chore: release v<version>`
- [ ] No local or remote tag for `v<version>` exists yet — tag is created by CI after merge
- [ ] After PR merges: `tag-on-merge.yml` creates `v<version>` tag on remote
- [ ] After tag is created: `release.yml` packages `.vsix` and creates GitHub Release
