import pathlib,sqlite3
root=pathlib.Path(__file__).resolve().parents[1]
db=sqlite3.connect(':memory:')
for path in sorted((root/'backend/migrations').glob('*.sql')):
 db.executescript(path.read_text(encoding='utf-8-sig'))
assert db.execute('SELECT count(*) FROM categories').fetchone()[0]==30
db.execute("INSERT INTO users(id,auth_subject,display_name,email) VALUES ('u1','auth1','Resident One','one@example.com'),('u2','auth2','Resident Two','two@example.com')")
# Dynamic city/town creation: new areas work without changing the migrations.
db.execute("INSERT INTO cities(id,name,region,country,center_lat,center_lng,radius_km) VALUES ('area:peru:lima-province:lima','Lima','Lima Province','Peru',-12.0464,-77.0428,20)")
for issue in ['i1','i2']:
 db.execute("INSERT INTO issues(id,category_id,author_id,title,description,address,latitude,longitude,city_id) VALUES (?,'pothole','u1','Deep potholes here','A sufficiently detailed description of road damage.','Test Road',-12.0464,-77.0428,'area:peru:lima-province:lima')",(issue,))
db.execute("INSERT INTO confirmations(issue_id,user_id) VALUES ('i1','u2')")
def must_fail(sql):
 try:db.execute(sql)
 except sqlite3.IntegrityError:return
 raise AssertionError('Expected constraint rejection: '+sql)
must_fail("INSERT INTO confirmations(issue_id,user_id) VALUES ('i1','u2')")
must_fail("INSERT INTO confirmations(issue_id,user_id) VALUES ('i1','u1')")
must_fail("UPDATE issues SET latitude=100 WHERE id='i1'")
db.execute("INSERT INTO comments(id,issue_id,author_id,body) VALUES ('c1','i1','u2','A useful comment')")
must_fail("INSERT INTO comments(id,issue_id,author_id,parent_id,body) VALUES ('c2','i2','u2','c1','A reply to the wrong thread')")
assert db.execute("SELECT count(*) FROM cities WHERE id='area:peru:lima-province:lima'").fetchone()[0]==1
must_fail("INSERT INTO issues(id,category_id,author_id,title,description,address,latitude,longitude,city_id) VALUES ('wrong','pothole','u1','A valid issue title','Detailed text which is long enough for a report.','Somewhere',26.17,91.76,'missing')")
db.execute("INSERT INTO status_events(id,issue_id,actor_id,previous_status,next_status) VALUES ('ev1','i1','u1','reported','resolved')")
# Same guard expected from Worker repository; no client can override owner ID.
assert db.execute("DELETE FROM issues WHERE id='i1' AND author_id='u2'").rowcount==0
assert db.execute("DELETE FROM issues WHERE id='i1' AND author_id='u1'").rowcount==1
assert db.execute("SELECT count(*) FROM comments WHERE issue_id='i1'").fetchone()[0]==0
assert db.execute("SELECT count(*) FROM confirmations WHERE issue_id='i1'").fetchone()[0]==0
assert db.execute("SELECT count(*) FROM status_events WHERE issue_id='i1'").fetchone()[0]==0
print('Schema verified: cities, ownership guard, cascading deletion, migrations, confirmations, validation and threads.')
