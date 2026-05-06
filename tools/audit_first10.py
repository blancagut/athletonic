import sqlite3
conn = sqlite3.connect('output/data/products.db')
first10 = ['transparent_labs','gorilla_mind','raw_nutrition','cellucor','muscletech','legion_athletics','optimum_nutrition','dymatize','bsn','myprotein']
print(f'{"brand":<22} {"total":>6} {"active":>6} {"disc":>5} {"excl":>5} {"desc%":>6} {"price%":>7} {"img%":>6}')
print('-'*72)
for b in first10:
    r = conn.execute('''SELECT COUNT(*),
        COALESCE(SUM(CASE WHEN COALESCE(discontinued,0)=0 AND COALESCE(excluded,0)=0 THEN 1 ELSE 0 END),0),
        COALESCE(SUM(COALESCE(discontinued,0)),0),
        COALESCE(SUM(COALESCE(excluded,0)),0),
        COALESCE(SUM(CASE WHEN description_html IS NOT NULL AND description_html != "" THEN 1 ELSE 0 END),0),
        COALESCE(SUM(CASE WHEN price IS NOT NULL THEN 1 ELSE 0 END),0)
        FROM products WHERE brand=?''',(b,)).fetchone()
    imgs = conn.execute('SELECT COUNT(DISTINCT product_row_id) FROM images WHERE product_row_id IN (SELECT id FROM products WHERE brand=?)',(b,)).fetchone()[0] or 0
    total = r[0] if r[0]>0 else 1
    print(f'{b:<22} {r[0]:>6} {r[1]:>6} {r[2]:>5} {r[3]:>5} {100*r[4]/total:>5.1f}% {100*r[5]/total:>6.1f}% {100*imgs/total:>5.1f}%')
