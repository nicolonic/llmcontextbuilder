# OAuth Troubleshooting Guide

## Google OAuth Setup

### Required Configuration in Google Cloud Console

1. **Go to Google Cloud Console**
   - Visit https://console.cloud.google.com
   - Select your project
   - Navigate to APIs & Services > Credentials
   - Click on your OAuth 2.0 Client ID

2. **Authorized JavaScript Origins**
   You must add BOTH of these URLs:
   ```
   https://llmcontextbuilder.com
   https://app.llmcontextbuilder.com
   ```

3. **Authorized Redirect URIs**
   Add this exact URL:
   ```
   https://syumnssymzdnzgcvxwgm.supabase.co/auth/v1/callback
   ```

### Common Issues and Solutions

#### Issue: "Error 400: redirect_uri_mismatch"
**Cause**: The redirect URI sent by the app doesn't match what's configured in Google.

**Solution**: 
1. Ensure the Supabase callback URL is added exactly as shown above
2. Wait 5-10 minutes for Google's changes to propagate
3. Clear browser cache and cookies

#### Issue: "Not a valid origin for the client"
**Cause**: The JavaScript origin (where the request comes from) isn't authorized.

**Solution**: 
1. Add `https://app.llmcontextbuilder.com` to Authorized JavaScript origins
2. Make sure there are no trailing slashes in the URLs

#### Issue: OAuth popup closes immediately
**Cause**: Various issues including CORS, cookies, or popup blockers.

**Solution**:
1. Disable popup blockers for the domain
2. Clear cookies for accounts.google.com
3. Try in an incognito/private window

### Debugging Steps

1. **Check Browser Console**
   - Open Developer Tools (F12)
   - Look for "OAuth Environment" log entry
   - Check for any error messages

2. **Verify Configuration**
   - Visit https://app.llmcontextbuilder.com/auth/debug
   - Confirm all values are correctly set

3. **Test OAuth Flow**
   - Clear all cookies and cache
   - Try signing in
   - Watch the network tab for the OAuth requests

### Microsoft OAuth Setup

Microsoft OAuth typically works without issues because:
- It only requires redirect URIs (no JavaScript origins)
- It's more flexible with redirect URL validation

### GitHub OAuth Setup

Similar to Microsoft, GitHub only requires:
- The callback URL in OAuth Apps settings
- No JavaScript origins needed

## Still Having Issues?

1. Double-check all URLs are HTTPS (not HTTP)
2. Ensure no typos in the domain names
3. Wait at least 5 minutes after making changes in Google Console
4. Try a different browser or incognito mode
5. Check if your Supabase project is properly configured with the correct OAuth credentials