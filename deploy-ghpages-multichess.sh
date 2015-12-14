#!/bin/bash
set -e # exit with nonzero exit code if anything fails

cd client/apps/chesshive/dist
git init

git config user.name "Travis CI"
git config user.email "theborakompanioni+github@gmail.com"

git add .
git commit -m "Deploy to GitHub Pages"
git push --force --quiet "https://${GH_TOKEN}@${GH_PAGES_MULTICHESS_REF}" master:master > /dev/null 2>&1