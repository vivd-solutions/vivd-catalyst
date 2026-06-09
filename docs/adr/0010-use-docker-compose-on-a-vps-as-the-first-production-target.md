# Use Docker Compose On A VPS As The First Production Target

The first operated production deployment should target an EU VPS or cloud VM running Docker Compose, using the same Docker images as local development. Postgres may be managed or run on the VPS; if it runs on the VPS, automated external backups to a bucket and a tested restore procedure are required. Kubernetes and managed container orchestration remain future deployment options, but they are not v1 requirements.

