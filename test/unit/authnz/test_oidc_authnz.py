import hashlib
import unittest
import uuid
from datetime import datetime, timedelta

import jwt
import requests
from six.moves.urllib.parse import parse_qs, urlparse

from galaxy.authnz import oidc_authnz
from galaxy.model import OIDCAccessToken, User


class OIDCAuthnzTestCase(unittest.TestCase):

    _create_oauth2_session_called = False
    _fetch_token_called = False
    _get_userinfo_called = False
    _raw_token = None

    def setUp(self):
        self.orig_requests_get = requests.get
        requests.get = self.mockRequest("https://test-well-known-oidc-config-uri", {
            "authorization_endpoint": "https://test-auth-endpoint",
            "token_endpoint": "https://test-token-endpoint",
            "userinfo_endpoint": "https://test-userinfo-endpoint"
        })
        self.oidc_authnz = oidc_authnz.OIDCAuthnz('Google', {
            'VERIFY_SSL': True
        }, {
            'client_id': 'test-client-id',
            'client_secret': 'test-client-secret',
            'redirect_uri': 'https://test-redirect-uri',
            'well_known_oidc_config_uri': 'https://test-well-known-oidc-config-uri',
            'extra_params': {
                'param1': 'value1'
            }
        })
        self.setupMocks()
        self.test_state = "abc123"
        self.test_nonce = b"4662892146306485421546981092"
        self.test_nonce_hash = hashlib.sha256(self.test_nonce).hexdigest()
        self.test_code = "test-code"
        self.test_username = "test-username"
        self.test_email = "test-email"
        self.test_alt_username = "test-alt-username"
        self.test_alt_email = "test-alt-email"
        self.test_access_token = "test_access_token"
        self.test_refresh_token = "test_refresh_token"
        self.test_expires_in = 30
        self.test_refresh_expires_in = 1800
        self.test_user_id = str(uuid.uuid4())
        self.test_alt_user_id = str(uuid.uuid4())
        self.trans.request.url = "https://localhost:8000/authnz/google/oidc/callback?state={test_state}&code={test_code}".format(test_state=self.test_state, test_code=self.test_code)

    def setupMocks(self):
        self.mock_fetch_token(self.oidc_authnz)
        self.mock_get_userinfo(self.oidc_authnz)
        self.trans = self.mockTrans()

    @property
    def test_id_token(self):
        return jwt.encode({'nonce': self.test_nonce_hash}, key=None, algorithm=None).decode()

    def mock_create_oauth2_session(self, oidc_authnz):
        orig_create_oauth2_session = oidc_authnz._create_oauth2_session

        def create_oauth2_session(state=None):
            self._create_oauth2_session_called = True
            assert state == self.test_state
            return orig_create_oauth2_session(state)
        oidc_authnz._create_oauth2_session = create_oauth2_session

    def mock_fetch_token(self, oidc_authnz):
        def fetch_token(oauth2_session, trans):
            self._fetch_token_called = True
            self._raw_token = {
                "access_token": self.test_access_token,
                "id_token": self.test_id_token,
                "refresh_token": self.test_refresh_token,
                "expires_in": self.test_expires_in,
                "refresh_expires_in": self.test_refresh_expires_in
            }
            return self._raw_token
        oidc_authnz._fetch_token = fetch_token

    def mock_get_userinfo(self, oidc_authnz):
        def get_userinfo(oauth2_session):
            self._get_userinfo_called = True
            return {
                "preferred_username": self.test_username,
                "email": self.test_email,
                "sub": self.test_user_id,
                "alt_username": self.test_alt_username,
                "alt_email": self.test_alt_email,
                "alt_id": self.test_alt_user_id
            }
        oidc_authnz._get_userinfo = get_userinfo

    def mockRequest(self, url, resp):
        def get(x):
            assert x == url
            return Response()

        class Response(object):
            def json(self):
                return resp

        return get

    def mockTrans(self):

        class Request:
            url = None

        class QueryResult:
            results = []

            def __init__(self, results=None):
                if results:
                    self.results = results

            def first(self):
                if len(self.results) > 0:
                    return self.results[0]
                else:
                    return None

            def one_or_none(self):
                if len(self.results) == 1:
                    return self.results[0]
                elif len(self.results) == 0:
                    return None
                else:
                    raise Exception("More than one result!")

        class Query:
            external_user_id = None
            provider = None
            oidc_access_token = None

            def filter_by(self, external_user_id=None, provider=None):
                self.external_user_id = external_user_id
                self.provider = provider
                if self.oidc_access_token:
                    return QueryResult([self.oidc_access_token])
                else:
                    return QueryResult()

        class Session:
            items = []
            flush_called = False
            _query = Query()
            deleted = []

            def add(self, item):
                self.items.append(item)

            def delete(self, item):
                self.deleted.append(item)

            def flush(self):
                self.flush_called = True

            def query(self, cls):
                return self._query

        class Trans:
            cookies = {}
            cookies_args = {}
            request = Request()
            sa_session = Session()
            user = None

            def set_cookie(self, value, name=None, **kwargs):
                self.cookies[name] = value
                self.cookies_args[name] = kwargs

            def get_cookie(self, name):
                return self.cookies[name]

        return Trans()

    def tearDown(self):
        requests.get = self.orig_requests_get

    def test_parse_config(self):
        self.assertTrue(self.oidc_authnz.config['verify_ssl'])
        self.assertEqual(self.oidc_authnz.config['client_id'], 'test-client-id')
        self.assertEqual(self.oidc_authnz.config['client_secret'], 'test-client-secret')
        self.assertEqual(self.oidc_authnz.config['redirect_uri'], 'https://test-redirect-uri')
        self.assertEqual(self.oidc_authnz.config['well_known_oidc_config_uri'], 'https://test-well-known-oidc-config-uri')
        self.assertEqual(self.oidc_authnz.config['authorization_endpoint'], 'https://test-auth-endpoint')
        self.assertEqual(self.oidc_authnz.config['token_endpoint'], 'https://test-token-endpoint')
        self.assertEqual(self.oidc_authnz.config['userinfo_endpoint'], 'https://test-userinfo-endpoint')
        self.assertIn('param1', self.oidc_authnz.config['extra_params'])
        self.assertEqual(self.oidc_authnz.config['extra_params']['param1'], 'value1')

    def test_parse_config_without_well_known_config(self):
        self.oidc_authnz = oidc_authnz.OIDCAuthnz('Google', {
            'VERIFY_SSL': True
        }, {
            'client_id': 'test-client-id2',
            'client_secret': 'test-client-secret2',
            'redirect_uri': 'https://test-redirect-uri2',
            "authorization_endpoint": "https://test-auth-endpoint2",
            "token_endpoint": "https://test-token-endpoint2",
            "userinfo_endpoint": "https://test-userinfo-endpoint2"
        })
        self.assertTrue(self.oidc_authnz.config['verify_ssl'])
        self.assertEqual(self.oidc_authnz.config['client_id'], 'test-client-id2')
        self.assertEqual(self.oidc_authnz.config['client_secret'], 'test-client-secret2')
        self.assertEqual(self.oidc_authnz.config['redirect_uri'], 'https://test-redirect-uri2')
        self.assertNotIn('well_known_oidc_config_uri', self.oidc_authnz.config)
        self.assertEqual(self.oidc_authnz.config['authorization_endpoint'], 'https://test-auth-endpoint2')
        self.assertEqual(self.oidc_authnz.config['token_endpoint'], 'https://test-token-endpoint2')
        self.assertEqual(self.oidc_authnz.config['userinfo_endpoint'], 'https://test-userinfo-endpoint2')

    def test_authenticate_set_state_cookie(self):
        """Verify that authenticate() sets a state cookie."""
        authorization_url = self.oidc_authnz.authenticate(self.trans)
        parsed = urlparse(authorization_url)
        state = parse_qs(parsed.query)['state'][0]
        self.assertEqual(state, self.trans.cookies[oidc_authnz.STATE_COOKIE_NAME])

    def test_authenticate_set_nonce_cookie(self):
        """Verify that authenticate() sets a nonce cookie."""
        authorization_url = self.oidc_authnz.authenticate(self.trans)
        parsed = urlparse(authorization_url)
        hashed_nonce_in_url = parse_qs(parsed.query)['nonce'][0]
        nonce_in_cookie = self.trans.cookies[oidc_authnz.NONCE_COOKIE_NAME]
        hashed_nonce = self.oidc_authnz._hash_nonce(nonce_in_cookie)
        self.assertEqual(hashed_nonce, hashed_nonce_in_url)

    def test_authenticate_adds_extra_params(self):
        """Verify that authenticate() adds configured extra params."""
        authorization_url = self.oidc_authnz.authenticate(self.trans)
        parsed = urlparse(authorization_url)
        param1_value = parse_qs(parsed.query)['param1'][0]
        self.assertEqual(param1_value, 'value1')

    def test_callback_verify_with_state_cookie(self):
        """Verify that state from cookie is passed to OAuth2Session constructor."""
        self.trans.set_cookie(value=self.test_state, name=oidc_authnz.STATE_COOKIE_NAME)
        self.trans.set_cookie(value=self.test_nonce, name=oidc_authnz.NONCE_COOKIE_NAME)
        self.trans.sa_session._query.user = User(email=self.test_email, username=self.test_username)

        # Mock _create_oauth2_session to make sure it is created with cookie state token
        self.mock_create_oauth2_session(self.oidc_authnz)

        # Intentionally passing a bad state_token to make sure that code under
        # test uses the state cookie instead when creating the OAuth2Session
        login_redirect_url, user = self.oidc_authnz.callback(
            state_token="xxx",
            authz_code=self.test_code, trans=self.trans,
            login_redirect_url="http://localhost:8000/")
        self.assertTrue(self._create_oauth2_session_called)
        self.assertTrue(self._fetch_token_called)
        self.assertTrue(self._get_userinfo_called)
        self.assertEqual(login_redirect_url, "http://localhost:8000/")
        self.assertIsNotNone(user)

    def test_callback_nonce_validation_with_bad_nonce(self):
        self.trans.set_cookie(value=self.test_state, name=oidc_authnz.STATE_COOKIE_NAME)
        self.trans.set_cookie(value=self.test_nonce, name=oidc_authnz.NONCE_COOKIE_NAME)
        self.trans.sa_session._query.user = User(email=self.test_email, username=self.test_username)

        # Intentionally create a bad nonce
        self.test_nonce_hash = self.test_nonce_hash + "Z"

        # self.oidc_authnz._fetch_token = fetch_token
        with self.assertRaises(Exception):
            self.oidc_authnz.callback(state_token="xxx",
                                      authz_code=self.test_code, trans=self.trans,
                                      login_redirect_url="http://localhost:8000/")
        self.assertTrue(self._fetch_token_called)
        self.assertFalse(self._get_userinfo_called)

    def test_callback_galaxy_user_created_when_no_oidc_access_token_exists(self):
        self.trans.set_cookie(value=self.test_state, name=oidc_authnz.STATE_COOKIE_NAME)
        self.trans.set_cookie(value=self.test_nonce, name=oidc_authnz.NONCE_COOKIE_NAME)

        self.assertIsNone(
            self.trans.sa_session.query(OIDCAccessToken)
                .filter_by(external_user_id=self.test_user_id,
                           provider=self.oidc_authnz.config['provider'])
                .one_or_none()
        )
        self.assertEqual(0, len(self.trans.sa_session.items))
        login_redirect_url, user = self.oidc_authnz.callback(
            state_token="xxx",
            authz_code=self.test_code, trans=self.trans,
            login_redirect_url="http://localhost:8000/")
        self.assertTrue(self._fetch_token_called)
        self.assertTrue(self._get_userinfo_called)
        self.assertEqual(2, len(self.trans.sa_session.items), "Session has new User and new OIDCAccessToken")
        added_user = self.trans.sa_session.items[0]
        self.assertIsInstance(added_user, User)
        self.assertEqual(self.test_username, added_user.username)
        self.assertEqual(self.test_email, added_user.email)
        self.assertIsNotNone(added_user.password)
        # Verify added_oidc_access_token
        added_oidc_access_token = self.trans.sa_session.items[1]
        self.assertIsInstance(added_oidc_access_token, OIDCAccessToken)
        self.assertIs(user, added_oidc_access_token.user)
        self.assertEqual(self.test_access_token, added_oidc_access_token.access_token)
        self.assertEqual(self.test_id_token, added_oidc_access_token.id_token)
        self.assertEqual(self.test_refresh_token, added_oidc_access_token.refresh_token)
        expected_expiration_time = datetime.now() + timedelta(seconds=self.test_expires_in)
        expiration_timedelta = expected_expiration_time - added_oidc_access_token.expiration_time
        self.assertTrue(expiration_timedelta.total_seconds() < 1)
        expected_refresh_expiration_time = datetime.now() + timedelta(seconds=self.test_refresh_expires_in)
        refresh_expiration_timedelta = expected_refresh_expiration_time - added_oidc_access_token.refresh_expiration_time
        self.assertTrue(refresh_expiration_timedelta.total_seconds() < 1)
        self.assertEqual(self._raw_token, added_oidc_access_token.raw_token)
        self.assertEqual(self.oidc_authnz.config['provider'], added_oidc_access_token.provider)
        self.assertTrue(self.trans.sa_session.flush_called)

    def test_callback_galaxy_user_not_created_when_user_logged_in_and_no_oidc_access_token_exists(self):
        """
        Galaxy user is already logged in and trying to associate external
        identity with their Galaxy user account. No new user should be created.
        """
        self.trans.set_cookie(value=self.test_state, name=oidc_authnz.STATE_COOKIE_NAME)
        self.trans.set_cookie(value=self.test_nonce, name=oidc_authnz.NONCE_COOKIE_NAME)
        self.trans.user = User()

        self.assertIsNone(
            self.trans.sa_session.query(OIDCAccessToken)
                .filter_by(external_user_id=self.test_user_id,
                           provider=self.oidc_authnz.config['provider'])
                .one_or_none()
        )
        self.assertEqual(0, len(self.trans.sa_session.items))
        login_redirect_url, user = self.oidc_authnz.callback(
            state_token="xxx",
            authz_code=self.test_code, trans=self.trans,
            login_redirect_url="http://localhost:8000/")
        self.assertTrue(self._fetch_token_called)
        self.assertTrue(self._get_userinfo_called)
        self.assertEqual(1, len(self.trans.sa_session.items), "Session has new OIDCAccessToken")
        # Verify added_oidc_access_token
        added_oidc_access_token = self.trans.sa_session.items[0]
        self.assertIsInstance(added_oidc_access_token, OIDCAccessToken)
        self.assertIs(user, added_oidc_access_token.user)
        self.assertIs(user, self.trans.user)
        self.assertTrue(self.trans.sa_session.flush_called)

    def test_callback_galaxy_user_created_with_alt_claim_mapping(self):
        self.oidc_authnz = oidc_authnz.OIDCAuthnz('Google', {
            'VERIFY_SSL': True
        }, {
            'client_id': 'test-client-id',
            'client_secret': 'test-client-secret',
            'redirect_uri': 'https://test-redirect-uri',
            'well_known_oidc_config_uri': 'https://test-well-known-oidc-config-uri',
            'userinfo_claim_mappings': {
                'email': 'alt_email',
                'username': 'alt_username',
                'id': 'alt_id'
            }
        })
        self.setupMocks()

        self.trans.set_cookie(value=self.test_state, name=oidc_authnz.STATE_COOKIE_NAME)
        self.trans.set_cookie(value=self.test_nonce, name=oidc_authnz.NONCE_COOKIE_NAME)
        login_redirect_url, user = self.oidc_authnz.callback(
            state_token="xxx",
            authz_code=self.test_code, trans=self.trans,
            login_redirect_url="http://localhost:8000/")
        self.assertEqual(self.test_alt_username, user.username)
        self.assertEqual(self.test_alt_email, user.email)
        self.assertEqual(2, len(self.trans.sa_session.items))
        added_oidc_access_token = self.trans.sa_session.items[1]
        self.assertEqual(self.test_alt_user_id, added_oidc_access_token.external_user_id)

    def test_callback_galaxy_user_not_created_when_oidc_access_token_exists(self):
        self.trans.set_cookie(value=self.test_state, name=oidc_authnz.STATE_COOKIE_NAME)
        self.trans.set_cookie(value=self.test_nonce, name=oidc_authnz.NONCE_COOKIE_NAME)
        old_access_token = "old-access-token"
        old_id_token = "old-id-token"
        old_refresh_token = "old-refresh-token"
        old_expiration_time = datetime.now() - timedelta(days=1)
        old_refresh_expiration_time = datetime.now() - timedelta(hours=3)
        old_raw_token = "{}"
        existing_oidc_access_token = OIDCAccessToken(
            user=User(email=self.test_email, username=self.test_username),
            external_user_id=self.test_user_id,
            provider=self.oidc_authnz.config['provider'],
            access_token=old_access_token,
            id_token=old_id_token,
            refresh_token=old_refresh_token,
            expiration_time=old_expiration_time,
            refresh_expiration_time=old_refresh_expiration_time,
            raw_token=old_raw_token,
        )

        self.trans.sa_session._query.oidc_access_token = existing_oidc_access_token

        self.assertIsNotNone(
            self.trans.sa_session.query(OIDCAccessToken)
                .filter_by(external_user_id=self.test_user_id,
                           provider=self.oidc_authnz.config['provider'])
                .one_or_none()
        ),
        self.assertEqual(0, len(self.trans.sa_session.items))
        login_redirect_url, user = self.oidc_authnz.callback(
            state_token="xxx",
            authz_code=self.test_code, trans=self.trans,
            login_redirect_url="http://localhost:8000/")
        self.assertTrue(self._fetch_token_called)
        self.assertTrue(self._get_userinfo_called)
        # Make sure query was called with correct parameters
        self.assertEqual(self.test_user_id, self.trans.sa_session._query.external_user_id)
        self.assertEqual(self.oidc_authnz.config['provider'], self.trans.sa_session._query.provider)
        self.assertEqual(1, len(self.trans.sa_session.items), "Session has updated OIDCAccessToken")
        session_oidc_access_token = self.trans.sa_session.items[0]
        self.assertIsInstance(session_oidc_access_token, OIDCAccessToken)
        self.assertIs(existing_oidc_access_token, session_oidc_access_token, "existing OIDCAccessToken should be updated")
        # Verify both that existing oidc_access_token has the correct values and different values than before
        self.assertEqual(self.test_access_token, session_oidc_access_token.access_token)
        self.assertNotEqual(old_access_token, session_oidc_access_token.access_token)
        self.assertEqual(self.test_id_token, session_oidc_access_token.id_token)
        self.assertNotEqual(old_id_token, session_oidc_access_token.id_token)
        self.assertEqual(self.test_refresh_token, session_oidc_access_token.refresh_token)
        self.assertNotEqual(old_refresh_token, session_oidc_access_token.refresh_token)
        expected_expiration_time = datetime.now() + timedelta(seconds=self.test_expires_in)
        expiration_timedelta = expected_expiration_time - session_oidc_access_token.expiration_time
        self.assertTrue(expiration_timedelta.total_seconds() < 1)
        self.assertNotEqual(old_expiration_time, session_oidc_access_token.expiration_time)
        expected_refresh_expiration_time = datetime.now() + timedelta(seconds=self.test_refresh_expires_in)
        refresh_expiration_timedelta = expected_refresh_expiration_time - session_oidc_access_token.refresh_expiration_time
        self.assertTrue(refresh_expiration_timedelta.total_seconds() < 1)
        self.assertNotEqual(old_refresh_expiration_time, session_oidc_access_token.refresh_expiration_time)
        self.assertEqual(self._raw_token, session_oidc_access_token.raw_token)
        self.assertNotEqual(old_raw_token, session_oidc_access_token.raw_token)
        self.assertTrue(self.trans.sa_session.flush_called)

    def test_disconnect(self):
        oidc_access_token = OIDCAccessToken(
            user=User(email=self.test_email, username=self.test_username),
            external_user_id=self.test_user_id,
            provider=self.oidc_authnz.config['provider'],
            access_token=self.test_access_token,
            id_token=self.test_id_token,
            refresh_token=self.test_refresh_token,
            expiration_time=datetime.now() + timedelta(seconds=self.test_refresh_expires_in),
            refresh_expiration_time=datetime.now() + timedelta(seconds=self.test_refresh_expires_in),
            raw_token="{}",
        )
        self.trans.user = oidc_access_token.user
        self.trans.user.oidc_auth = [oidc_access_token]

        success, message, redirect_uri = self.oidc_authnz.disconnect("Google", self.trans, "/")

        self.assertEqual(1, len(self.trans.sa_session.deleted))
        deleted_token = self.trans.sa_session.deleted[0]
        self.assertIs(oidc_access_token, deleted_token)
        self.assertTrue(self.trans.sa_session.flush_called)
        self.assertTrue(success)
        self.assertEqual("", message)
        self.assertEqual("/", redirect_uri)

    def test_disconnect_when_no_associated_provider(self):
        self.trans.user = User()
        success, message, redirect_uri = self.oidc_authnz.disconnect("Google", self.trans, "/")
        self.assertEqual(0, len(self.trans.sa_session.deleted))
        self.assertFalse(self.trans.sa_session.flush_called)
        self.assertFalse(success)
        self.assertNotEqual("", message)
        self.assertIsNone(redirect_uri)

    def test_disconnect_when_more_than_one_associated_token_for_provider(self):
        self.trans.user = User(email=self.test_email, username=self.test_username)
        oidc_access_token1 = OIDCAccessToken(
            user=self.trans.user,
            external_user_id=self.test_user_id + "1",
            provider=self.oidc_authnz.config['provider'],
            access_token=self.test_access_token,
            id_token=self.test_id_token,
            refresh_token=self.test_refresh_token,
            expiration_time=datetime.now() + timedelta(seconds=self.test_refresh_expires_in),
            refresh_expiration_time=datetime.now() + timedelta(seconds=self.test_refresh_expires_in),
            raw_token="{}",
        )
        oidc_access_token2 = OIDCAccessToken(
            user=self.trans.user,
            external_user_id=self.test_user_id + "2",
            provider=self.oidc_authnz.config['provider'],
            access_token=self.test_access_token,
            id_token=self.test_id_token,
            refresh_token=self.test_refresh_token,
            expiration_time=datetime.now() + timedelta(seconds=self.test_refresh_expires_in),
            refresh_expiration_time=datetime.now() + timedelta(seconds=self.test_refresh_expires_in),
            raw_token="{}",
        )
        self.trans.user.oidc_auth = [oidc_access_token1, oidc_access_token2]

        success, message, redirect_uri = self.oidc_authnz.disconnect("Google", self.trans, "/")

        self.assertEqual(0, len(self.trans.sa_session.deleted))
        self.assertFalse(self.trans.sa_session.flush_called)
        self.assertFalse(success)
        self.assertNotEqual("", message)
        self.assertIsNone(redirect_uri)
