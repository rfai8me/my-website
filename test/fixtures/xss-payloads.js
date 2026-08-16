// Regression subset derived from OWASP's XSS Filter Evasion Cheat Sheet.
export const xssPayloads = Object.freeze([
  '<script>alert(1)</script>',
  '<svg/onload=alert(1)>',
  '<iframe src="data:text/html,<svg onload=alert(1)>"></iframe>',
  '<a onmouseover="alert(1)">hover</a>',
  '<img src="x" onerror="alert(1)">',
  '<img src="x" onerror="&#97;&#108;&#101;&#114;&#116;&#40;1&#41;">',
  '<a href="javascript:alert(1)">javascript</a>',
  '<a href="data:text/html,<script>alert(1)</script>">data</a>',
  '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">decimal</a>',
  '<a href="&#x6A&#x61&#x76&#x61&#x73&#x63&#x72&#x69&#x70&#x74&#x3Aalert(1)">hex</a>',
  '<div style="background-image:url(javascript:alert(1))">styled</div>',
  '<object data="javascript:alert(1)"></object>',
  '<IMG ""><SCRIPT>alert(1)</SCRIPT>">',
  '<<SCRIPT>alert(1);//<</SCRIPT>'
]);
