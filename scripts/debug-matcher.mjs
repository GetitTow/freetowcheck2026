async function check() {
  const url = 'http://localhost:4321/trailer-matcher/?year=2014&make=ford&model=f-150&config=cfg-ford-f-150-2014-35-4wd-maxtow&trailer_weight=5000&tongue_weight=550&passengers=300&cargo=150';
  const res = await fetch(url);
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Includes Compatibility result:', text.includes('Compatibility result'));
  console.log('Includes Result: 2014 Ford F-150:', text.includes('Result: 2014 Ford F-150'));
  console.log('Includes formError:', text.includes('formError'));
  if (text.includes('result-panel')) {
    const idx = text.indexOf('result-panel');
    console.log('Result panel snippet:\n', text.slice(idx - 10, idx + 400));
  }
}
check();
