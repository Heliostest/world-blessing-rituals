"""Verify downloaded signed packages against this application's offline manifest."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import plistlib
import re
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
EXPO = json.loads((ROOT / 'apps/mobile-expo/app.json').read_text(encoding='utf-8'))['expo']
ASSETS = json.loads((ROOT / 'apps/mobile-expo/public/wbr-assets.json').read_text(encoding='utf-8'))

# AAB AndroidManifest.xml uses AAPT2's protobuf XML, rather than APK binary XML.
# Field numbers: Android Open Source Project tools/aapt2/Resources.proto.
# https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/tools/aapt2/Resources.proto
def protobuf_fields(data):
    offset = 0
    def varint():
        nonlocal offset
        value = shift = 0
        while True:
            assert offset < len(data) and shift <= 63, 'Invalid protobuf varint'
            byte = data[offset]
            offset += 1
            value |= (byte & 127) << shift
            if not byte & 128:
                return value
            shift += 7
    while offset < len(data):
        key = varint()
        field, wire = key >> 3, key & 7
        assert field, 'Invalid protobuf field'
        if wire == 0:
            value = varint()
        elif wire in (1, 2, 5):
            length = varint() if wire == 2 else (8 if wire == 1 else 4)
            assert offset + length <= len(data), 'Truncated protobuf field'
            value = data[offset:offset+length]
            offset += length
        else:
            raise AssertionError('Unsupported protobuf wire type')
        yield field, value

def aab_xml_node(data):
    node = dict(protobuf_fields(data))
    if 1 not in node:
        return None  # Text node.
    name, attributes, children = '', {}, []
    for field, value in protobuf_fields(node[1]):
        if field == 3:
            name = value.decode('utf-8')
        elif field == 4:
            attr = dict(protobuf_fields(value))
            key = attr[2].decode('utf-8')
            raw = attr.get(3, b'').decode('utf-8')
            if not raw and 6 in attr:
                item = dict(protobuf_fields(attr[6]))
                if 7 in item:
                    primitive = dict(protobuf_fields(item[7]))
                    for numeric_field in (6, 7, 8):
                        if numeric_field in primitive:
                            raw = str(primitive[numeric_field])
                            break
                else:
                    for string_field in (2, 3):
                        if string_field in item:
                            raw = dict(protobuf_fields(item[string_field])).get(1, b'').decode('utf-8')
                            break
            attributes[key] = raw
        elif field == 5:
            child = aab_xml_node(value)
            if child:
                children.append(child)
    return {'name':name, 'attributes':attributes, 'children':children}

def inspect(filename):
    filename = Path(filename)
    with zipfile.ZipFile(filename) as archive:
        assert archive.testzip() is None, 'Invalid package ZIP checksum'
        names = archive.namelist()
        html = [n for n in names if '/www.bundle/' in n and n.endswith('.html')]
        assert len(html) == 1, 'Expected exactly one DOM HTML'
        dom = str(PurePosixPath(html[0]).parent) + '/'
        scripts = [n for n in names if n.startswith(dom) and n.endswith('.js')]
        css = [n for n in names if n.startswith(dom) and n.endswith('.css')]
        assert scripts and css, 'Missing DOM code'
        native = [n for n in names if n.endswith('main.jsbundle') or n.endswith('index.android.bundle')]
        assert len(native) == 1 and archive.getinfo(native[0]).file_size > 0, 'Missing native main bundle'
        assert json.loads(archive.read(dom+'wbr-assets.json')) == ASSETS, 'Package manifest differs from source'
        for asset in ASSETS:
            data = archive.read(dom+asset['file'])
            assert len(data) == asset['bytes'] and hashlib.sha256(data).hexdigest() == asset['sha256'], 'Offline asset mismatch: '+asset['file']
        references = re.findall(r'(?:src|href)=["\'](\./[^"\']+\.(?:js|css))["\']', archive.read(html[0]).decode())
        for reference in references:
            assert archive.getinfo(dom+reference[2:]).file_size > 0, 'Empty HTML dependency'
        for name in scripts:
            source = archive.read(name).decode()
            assert source, 'Empty JS chunk'
            for reference in re.findall(r'["\'](\./_expo/static/js/web/[^"\']+\.js)["\']',source):
                assert archive.getinfo(dom+reference[2:]).file_size > 0, 'Missing dynamic chunk'
        result = {'file':str(filename.resolve()),'bytes':filename.stat().st_size,'sha256':hashlib.sha256(filename.read_bytes()).hexdigest(),'offlineAssets':len(ASSETS),'domScripts':len(scripts),'domStyles':len(css),'nativeBundle':native[0]}
        if filename.suffix == '.aab':
            manifest = aab_xml_node(archive.read('base/manifest/AndroidManifest.xml'))
            assert manifest and manifest['name'] == 'manifest', 'Invalid AAB manifest'
            attributes = manifest['attributes']
            assert attributes['package'] == EXPO['android']['package'], 'Wrong Android app'
            assert attributes['versionName'] == EXPO['version'], 'Wrong Android version'
            sdk = next(child['attributes'] for child in manifest['children'] if child['name'] == 'uses-sdk')
            permissions = sorted(child['attributes']['name'] for child in manifest['children'] if child['name'].startswith('uses-permission'))
            assert not set(permissions).intersection(EXPO['android'].get('blockedPermissions', [])), 'Blocked Android permission in AAB'
            result['android'] = {'package':attributes['package'], 'versionName':attributes['versionName'], 'versionCode':int(attributes['versionCode']), 'minSdk':int(sdk['minSdkVersion']), 'targetSdk':int(sdk['targetSdkVersion']), 'permissions':permissions}
        if filename.suffix == '.ipa':
            app = dom.split('/www.bundle/')[0]
            info = plistlib.loads(archive.read(app+'/Info.plist'))
            assert info['CFBundleIdentifier'] == EXPO['ios']['bundleIdentifier'], 'Wrong iOS app'
            assert info['CFBundleShortVersionString'] == EXPO['version'], 'Wrong version'
            assert app+'/embedded.mobileprovision' in names and app+'/_CodeSignature/CodeResources' in names, 'Missing signing resources'
            result['ios'] = {k:info.get(k) for k in ['CFBundleIdentifier','CFBundleShortVersionString','CFBundleVersion','MinimumOSVersion','UIDeviceFamily','ITSAppUsesNonExemptEncryption']}
            profile_bytes = archive.read(app+'/embedded.mobileprovision')
            start, end = profile_bytes.index(b'<?xml'), profile_bytes.index(b'</plist>')+len(b'</plist>')
            profile = plistlib.loads(profile_bytes[start:end])
            assert profile['TeamIdentifier'] == [EXPO['ios']['appleTeamId']], 'Wrong Apple Team in signing profile'
            assert profile['Entitlements']['application-identifier'] == EXPO['ios']['appleTeamId']+'.'+EXPO['ios']['bundleIdentifier'], 'Wrong provisioning application identity'
            assert not profile['Entitlements'].get('get-task-allow',False), 'Unexpected development signing'
            result['ios']['profile'] = {'uuid':profile['UUID'],'team':profile['TeamIdentifier'][0],'expires':profile['ExpirationDate'].isoformat()+'Z','distribution':'ad-hoc' if 'ProvisionedDevices' in profile else 'app-store','registeredDeviceCount':len(profile.get('ProvisionedDevices',[]))}
            result['privacyManifests'] = [{ 'file':n, **plistlib.loads(archive.read(n)) } for n in names if n.endswith('PrivacyInfo.xcprivacy')]
        return result

results = [inspect(name) for name in sys.argv[1:]]
assert results, 'Pass at least one APK/AAB/IPA path'
out = ROOT / 'artifacts/mobile-verification/package-inspection.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({'packages':results},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps([{k:v for k,v in result.items() if k != 'privacyManifests'} for result in results],ensure_ascii=True,indent=2))
