# VoxPilot Scheduling

This directory is the reproducible VoxPilot product layer on top of the
MIT-licensed Cal.diy source in this repository.

The image is pinned to the exact upstream digest currently used by the live
service. Brand files are approved VoxPilot Cutline Signal artwork. Runtime
credentials and customer data remain outside Git.

Build from the repository root:

```sh
docker build --platform linux/amd64 -f deploy/voxpilot/Dockerfile \
  -t voxpilot-scheduling:2026.08.12-source.1 \
  deploy/voxpilot
```

The baseline supports appointment and consultation scheduling, availability
controls, confirmation email, and calendar invites. Restaurant work starts as
a request-and-confirmation workflow; table inventory, floor plans, and
waitlists are separate modules, not capabilities claimed by this baseline.

The upstream MIT license in the repository root remains authoritative. Keep
the `upstream` Git remote connected to `https://github.com/calcom/cal.diy`
so security and maintenance changes can be reviewed deliberately.
