# App Engine Deployment Troubleshooting Guide

## Common Deployment Errors (2024)

### Error 1: Failed to create image cache - Permission denied

**Full Error Message:**
```
ERROR: failed to create image cache: accessing cache image "us.gcr.io/PROJECT_ID/app-engine-tmp/build-cache/...": 
DENIED: Permission "artifactregistry.repositories.downloadArtifacts" denied
```

**Cause:**
- Google Cloud migrated from Container Registry to Artifact Registry in May 2024
- New projects created after this date have different default permissions
- The App Engine default service account lacks necessary permissions

**Solution:**
Run the permission fix script:
```bash
./fix_deployment_permissions.sh
```

Or manually grant permissions:
```bash
# Grant Cloud Build Editor role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"

# Grant Artifact Registry Repository Admin role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/artifactregistry.repoAdmin"
```

### Error 2: Failed at analyzer step accessing us.gcr.io

**Full Error Message:**
```
ERROR: failed to initialize analyzer: validating registry read access: 
ensure registry read access to us.gcr.io/PROJECT_ID/app-engine-tmp/
```

**Cause:**
- Related to the Artifact Registry migration
- Build process cannot access the temporary build cache

**Solution:**
1. Enable required APIs:
```bash
gcloud services enable artifactregistry.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

2. Create Artifact Registry repository (if needed):
```bash
gcloud artifacts repositories create app-engine-tmp \
  --repository-format=docker \
  --location=us \
  --description="App Engine temporary build images"
```

## Quick Diagnosis Steps

1. **Check current project:**
```bash
gcloud config get-value project
```

2. **Verify service account permissions:**
```bash
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com"
```

3. **Check enabled APIs:**
```bash
gcloud services list --enabled | grep -E "(artifact|container|cloudbuild|appengine)"
```

## Prevention Tips

1. **For new projects:** Always run `fix_deployment_permissions.sh` before first deployment
2. **Use updated deploy script:** The updated `deploy.sh` now includes permission checks
3. **Monitor changes:** Google Cloud frequently updates permissions and services

## Additional Resources

- [Google Cloud App Engine Troubleshooting](https://cloud.google.com/appengine/docs/standard/troubleshooter/deployment)
- [Artifact Registry Documentation](https://cloud.google.com/artifact-registry/docs)
- [Cloud Build Service Account Configuration](https://cloud.google.com/build/docs/cloud-build-service-account)

## If Issues Persist

1. **Enable debug logging:**
```bash
gcloud app deploy --verbosity=debug
```

2. **Check Cloud Build logs:**
```bash
gcloud builds list --limit=5
gcloud builds log BUILD_ID
```

3. **Verify project configuration:**
```bash
gcloud config list
```

4. **Contact support** with:
   - Project ID
   - Full error messages
   - Output of diagnostic commands above