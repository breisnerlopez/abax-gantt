#!/usr/bin/env bash
# Mint Authentik access tokens for akadmin + responsable + ejecutor (UAT/regression).
# Requires sudo docker access on the Authentik host.
# Usage: source <(ops/mint-test-tokens.sh)
set -euo pipefail

sudo docker exec authentik-server ak shell -c "
from authentik.providers.oauth2.models import AccessToken, OAuth2Provider, ScopeMapping
from authentik.providers.oauth2.id_token import IDToken
from authentik.core.models import User
from django.utils.timezone import now
from datetime import timedelta
from django.test import RequestFactory

def mint(username):
    rf = RequestFactory()
    req = rf.get('/', HTTP_HOST='<authentik-host>', secure=True)
    user = User.objects.get(username=username)
    req.user = user
    provider = OAuth2Provider.objects.get(client_id='abax-gantt-spa')
    scope_names = []
    for pm in provider.property_mappings.all():
        sm = ScopeMapping.objects.filter(pk=pm.pk).first()
        if sm:
            scope_names.append(sm.scope_name)
    token = AccessToken(
        user=user, provider=provider, _scope=' '.join(scope_names),
        auth_time=now(), expires=now()+timedelta(hours=8),
    )
    id_token = IDToken.new(provider, token, request=req)
    token.id_token = id_token
    token.save()
    return token.token

for u in ['akadmin','responsable','ejecutor']:
    print(f'export {u.upper()}_TOKEN=' + mint(u))
" 2>&1 | grep -E '^export (AKADMIN|RESPONSABLE|EJECUTOR)_TOKEN='
