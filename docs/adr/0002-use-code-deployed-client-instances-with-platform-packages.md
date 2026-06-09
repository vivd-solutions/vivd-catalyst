# Use Code-Deployed Client Instances With Platform Packages

Client instances will be built from source-controlled code and configuration that import reusable platform packages. A CLI may validate, test, package, or deploy those inputs, but it should not be the primary way to mutate a running instance. This makes custom tools, agent configuration, and platform version upgrades reproducible and auditable while preserving the option to publish the platform packages separately later.

