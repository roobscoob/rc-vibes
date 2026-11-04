# Someone's changes to a sketch, pushed to main, for adding it to the room
# with them (src/server/boxes.ts, publish): run by a box's agent
# (box/agent.ts), in a box claimed only for this, as them, in their home.
# Everything in their clone that isn't ignored is committed, put on top of
# main's latest, and pushed. Its last line says how it went: "pushed
# <commit>". It ends 3 if their changes clash with what's on main since (so
# nothing's pushed; their commit stays in their clone), and 4 if their clone
# is in the middle of something (a rebase, a merge) they need to finish first.

cd "$VIBES_FOLDER"
export GIT_TERMINAL_PROMPT=0

# Who commits, and the box's token for vibes, as start.sh sets them up (for a
# clone whose box set it up for a vibes somewhere else, or with a token since
# gone): for this run's git only, written to no config, so running it outside
# a box (a test, a laptop) can't change anyone's git.
export GIT_CONFIG_COUNT=3
export GIT_CONFIG_KEY_0=user.name GIT_CONFIG_VALUE_0="$VIBES_USER_NAME"
export GIT_CONFIG_KEY_1=user.email GIT_CONFIG_VALUE_1="$VIBES_USER_EMAIL"
# shellcheck disable=SC2016
export GIT_CONFIG_KEY_2=credential.helper GIT_CONFIG_VALUE_2='!f() { echo username=box; echo "password=$VIBES_BOX_TOKEN"; }; f'
git remote set-url origin "$VIBES_GIT_URL"

gitdir=$(git rev-parse --git-dir)
for busy in rebase-merge rebase-apply MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD; do
  if [ -e "$gitdir/$busy" ]; then
    echo "busy: $busy"
    exit 4
  fi
done

git add --all
if ! git diff --cached --quiet; then
  git commit --quiet --message "$VIBES_COMMIT_MESSAGE"
fi
git fetch --quiet origin main
if ! git rebase --quiet origin/main; then
  git rebase --abort
  echo clash
  exit 3
fi
git push --quiet origin HEAD:main
echo "pushed $(git rev-parse HEAD)"
