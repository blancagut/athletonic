import sqlite3, re
conn = sqlite3.connect('output/data/products.db')
brands = ['transparent_labs','gorilla_mind','raw_nutrition','cellucor','muscletech','legion_athletics','optimum_nutrition','dymatize','bsn','myprotein']
for b in brands:
    rows = conn.execute('SELECT product_id FROM products WHERE brand=?',(b,)).fetchall()
    sources = {}
    for (pid,) in rows:
        m = re.match(r'^([a-z][a-z_]*[a-z])_\d', pid)
        src = m.group(1) if m else 'direct'
        sources[src] = sources.get(src,0)+1
    print(f'{b:<22} total={len(rows):<5} {sources}')
