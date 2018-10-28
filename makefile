NODE = node
TSC = node_modules/.bin/tsc
NODEMON = nodemon
ENTRY_POINT = built/app.js
MOCHA = mocha
TEST_BUILT = built/server/test/
WAIT = ../shared/bin/wait
DOCKER_IMAGE = chatnoirdigitalcoop/openride-server

TS_FILES = $(shell find app/ -type f -name '*.ts') 
#
# Phonies target
.PHONY: start compile watch install

# Generate the main entrypoint
$(ENTRY_POINT): $(TS_FILES) 
	@echo "Compiling the server"
	$(TSC)

# Start the main entrypoint
start: $(ENTRY_POINT)
	@echo "Starting the server"
	$(NODE) $(ENTRY_POINT)

watch: 
	@echo "Watching the server"
	$(NODEMON) --watch app/ -e ts --exec "make start || true"

compile_tests: 
	@echo "Compiling the tests"
	$(TSC) -p test/tsconfig.json

test: compile_tests	
	@echo "Launching the tests"
	$(WAIT)
	$(MOCHA) $(TEST_BUILT) || true

watch-test: 
	nodemon -w test -w app --exec "make test" -e ts

clean: 
	@echo "Cleaning the built directory"
	rm built -fr

install: 
	@echo "Installing npm modules"
	npm i

docker:
	@echo "Running the docker image"
	docker run -v /usr/src/openride/logs:/var/log/openride -p 3000:3000 -d $(DOCKER_IMAGE)
