"""Minimal read-only GitHub REST client for the trusted verifier; stdlib only.

The endpoint is a constant, not configuration: no caller can point the token at
another host. Redirects are refused and the Authorization header is attached
as an unredirected header, so it is never forwarded. Pagination follows the
`link` header (rel="next"), as GitHub documents, but only to the same origin.
Error messages carry status codes and GitHub's message, never the token.
"""
import json
import re
import socket
import ssl
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit
import urllib.request

API_ROOT = 'https://api.github.com'
API_VERSION = '2026-03-10'
USER_AGENT = 'harness-sdd-trusted-verifier'
MAX_BYTES = 8 * 1024 * 1024
MAX_PAGES = 50
LINK = re.compile(r'<([^>]+)>\s*;\s*rel="([^"]+)"')
REPOSITORY = re.compile(r'^([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100})$')


class ProviderError(ValueError):
    """Provider data could not be obtained or trusted; required review fails closed."""


class ProviderUnavailable(ProviderError):
    """Transport failure, outage, rate limit, or inaccessible resource."""


class ProviderAuthError(ProviderError):
    """The token is missing, rejected, or lacks the required read permission."""


class _RefuseRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, stream, code, message, headers, new_url):
        raise ProviderError('provider redirect refused (HTTP {})'.format(code))


class UrllibTransport(object):
    """HTTPS GET with certificate verification, a timeout, and a size limit."""

    def __init__(self, timeout=20.0):
        self.timeout = timeout
        self.opener = urllib.request.build_opener(
            _RefuseRedirect(), urllib.request.HTTPSHandler(context=ssl.create_default_context()))

    def get(self, url, headers, secret_headers):
        request = urllib.request.Request(url, method='GET')
        for name, value in headers.items():
            request.add_header(name, value)
        for name, value in secret_headers.items():
            request.add_unredirected_header(name, value)
        try:
            with self.opener.open(request, timeout=self.timeout) as response:
                return response.status, _lower(response.headers), _bounded(response)
        except HTTPError as error:
            body = _bounded(error) if error.fp is not None else b''
            return error.code, _lower(error.headers or {}), body
        except ProviderError:
            raise
        except (URLError, socket.timeout, ssl.SSLError, ConnectionError, OSError) as error:
            reason = getattr(error, 'reason', error)
            raise ProviderUnavailable('provider transport error: ' + type(reason).__name__)


def _lower(headers):
    return {str(name).lower(): str(value) for name, value in dict(headers).items()}


def _bounded(stream):
    body = stream.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ProviderError('provider response exceeds {} bytes'.format(MAX_BYTES))
    return body


def next_link(header):
    for url, relation in LINK.findall(header or ''):
        if relation == 'next':
            return url
    return None


def _same_origin(url):
    parts, root = urlsplit(url), urlsplit(API_ROOT)
    return (parts.scheme, parts.netloc) == (root.scheme, root.netloc) and not parts.username


class GitHubClient(object):
    def __init__(self, token, repository, transport=None):
        if not isinstance(token, str) or not token.strip() or any(c.isspace() for c in token):
            raise ProviderAuthError('provider token is missing or malformed')
        match = REPOSITORY.match(repository or '')
        if not match:
            raise ProviderError('repository must be owner/name')
        self._token = token
        self._prefix = '{}/repos/{}/{}'.format(API_ROOT, quote(match.group(1), safe=''),
                                               quote(match.group(2), safe=''))
        self._transport = transport or UrllibTransport()

    def __repr__(self):
        return '<GitHubClient {}>'.format(self._prefix)

    def _clean(self, text):
        return str(text).replace(self._token, '[redacted]')[:300]

    def _get(self, url):
        if not _same_origin(url):
            raise ProviderError('refusing to send the token to another origin')
        status, headers, body = self._transport.get(
            url, {'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': API_VERSION,
                  'User-Agent': USER_AGENT},
            {'Authorization': 'Bearer ' + self._token})
        if status == 200:
            try:
                return json.loads(body.decode('utf-8')), headers
            except ValueError:
                raise ProviderError('provider returned invalid JSON')
        try:
            message = self._clean(json.loads(body.decode('utf-8')).get('message', ''))
        except (ValueError, AttributeError):
            message = ''
        detail = 'HTTP {}{}'.format(status, ': ' + message if message else '')
        if status == 401:
            raise ProviderAuthError('provider rejected the token (' + detail + ')')
        if status == 429 or (status == 403 and (headers.get('x-ratelimit-remaining') == '0'
                                                 or 'rate limit' in message.lower())):
            raise ProviderUnavailable('provider rate limit reached (' + detail + ')')
        if status == 403:
            raise ProviderAuthError('token lacks read permission (' + detail + ')')
        if status == 404:
            raise ProviderUnavailable('resource not found or not visible to the token (' + detail + ')')
        if status >= 500:
            raise ProviderUnavailable('provider unavailable (' + detail + ')')
        raise ProviderError('unexpected provider response (' + detail + ')')

    def get_object(self, path):
        value, _headers = self._get(self._prefix + path)
        if not isinstance(value, dict):
            raise ProviderError('provider returned a non-object for ' + path)
        return value

    def get_list(self, path):
        url = '{}{}?{}'.format(self._prefix, path, urlencode({'per_page': 100}))
        items = []
        for _page in range(MAX_PAGES):
            value, headers = self._get(url)
            if not isinstance(value, list):
                raise ProviderError('provider returned a non-array for ' + path)
            items.extend(value)
            url = next_link(headers.get('link'))
            if url is None:
                return items
        raise ProviderError('provider pagination exceeded {} pages'.format(MAX_PAGES))

    def pull(self, number):
        return self.get_object('/pulls/{}'.format(int(number)))

    def reviews(self, number):
        return self.get_list('/pulls/{}/reviews'.format(int(number)))
